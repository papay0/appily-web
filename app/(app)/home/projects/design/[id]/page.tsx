"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { ProjectHeader } from "@/components/project-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  ArrowRight,
  Loader2,
  Send,
  User,
  Sparkles,
  SkipForward,
  Layers,
  Wand2,
  Files,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DesignCanvas } from "@/components/design-generator/design-canvas";
import type { ParsedScreen } from "@/components/design-generator/streaming-screen-preview";
import type { Feature } from "@/lib/types/features";
import type { ProjectDesign, DesignInsert } from "@/lib/types/designs";

interface Project {
  id: string;
  name: string;
  app_idea: string | null;
  planning_completed_at: string | null;
  design_completed_at: string | null;
  image_keys: string[] | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function DesignPageSkeleton() {
  return (
    <div className="flex flex-col h-full relative">
      {/* Gradient orbs background */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] opacity-30 dark:opacity-15 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-200/60 dark:bg-purple-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-blue-200/50 dark:bg-blue-500/15 rounded-full blur-[120px]" />
        </div>
      </div>

      <ProjectHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-16 w-16 rounded-2xl mx-auto bg-muted/50" />
          <Skeleton className="h-6 w-48 mx-auto bg-muted/50" />
          <Skeleton className="h-4 w-64 mx-auto bg-muted/30" />
        </div>
      </div>
    </div>
  );
}

export default function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPrompt, setStreamingPrompt] = useState("");
  const [streamedScreens, setStreamedScreens] = useState<ParsedScreen[] | null>(null);
  const [completedScreens, setCompletedScreens] = useState<ParsedScreen[]>([]);
  const hasAutoStarted = useRef(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  const screenCountRef = useRef(0);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load project, features, and existing designs
  useEffect(() => {
    async function loadProject() {
      if (!user) return;

      try {
        // Fetch project data
        const { data: projectData, error } = await supabase
          .from("projects")
          .select("id, name, app_idea, planning_completed_at, design_completed_at, image_keys")
          .eq("id", projectId)
          .single();

        if (error || !projectData) {
          console.error("Error loading project:", error);
          router.push("/home");
          return;
        }

        // If planning is not completed, redirect to plan
        if (!projectData.planning_completed_at) {
          router.push(`/home/projects/plan/${projectId}`);
          return;
        }

        // If design is already completed, redirect to build
        if (projectData.design_completed_at) {
          router.push(`/home/projects/build/${projectId}`);
          return;
        }

        setProject(projectData);

        // Load features for context
        const { data: featuresData } = await supabase
          .from("project_features")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });

        if (featuresData) {
          setFeatures(featuresData);
        }

        // Check for existing designs (if user came back)
        const { data: existingDesigns } = await supabase
          .from("project_designs")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });

        if (existingDesigns && existingDesigns.length > 0) {
          // Convert to ParsedScreen format
          const screens: ParsedScreen[] = existingDesigns.map((d: ProjectDesign) => ({
            name: d.screen_name,
            html: d.html_content,
          }));
          setStreamedScreens(screens);
          setCompletedScreens(screens);
          setHasLoadedFromDb(true);
          // Add a message showing designs were loaded
          setMessages([{
            role: "assistant",
            content: `Welcome back! Your ${screens.length} design${screens.length !== 1 ? "s" : ""} ${screens.length !== 1 ? "are" : "is"} ready: ${screens.map(s => s.name).join(", ")}.`,
            timestamp: new Date(),
          }]);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error:", error);
        router.push("/home");
      }
    }

    loadProject();
  }, [user, projectId, supabase, router]);

  // Auto-start design generation when loaded (if no existing designs)
  useEffect(() => {
    if (!loading && project?.app_idea && !hasAutoStarted.current && !hasLoadedFromDb && completedScreens.length === 0) {
      hasAutoStarted.current = true;
      startDesignGeneration(project.app_idea, true);
    }
  }, [loading, project, completedScreens.length, hasLoadedFromDb]);

  const startDesignGeneration = async (prompt: string, isAutoStart = false) => {
    setIsStreaming(true);
    setStreamingPrompt(prompt);
    setStreamedScreens(null);
    // Reset screen count for new generation
    screenCountRef.current = completedScreens.length;

    // For auto-start, show the app idea as a "user" message first
    if (isAutoStart) {
      const appIdeaMessage: ChatMessage = {
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages([appIdeaMessage]);
    }

    // Add assistant message indicating streaming started
    const streamingMessage: ChatMessage = {
      role: "assistant",
      content: "Generating your app design...",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, streamingMessage]);
  };

  // Save a single screen to database as it completes
  const saveScreenToDatabase = useCallback(async (screen: ParsedScreen, sortOrder: number) => {
    try {
      // Check if screen already exists for this project
      const { data: existing } = await supabase
        .from("project_designs")
        .select("id")
        .eq("project_id", projectId)
        .eq("screen_name", screen.name)
        .single();

      if (existing) {
        // Update existing screen
        await supabase
          .from("project_designs")
          .update({ html_content: screen.html, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        // Insert new screen
        await supabase
          .from("project_designs")
          .insert({
            project_id: projectId,
            screen_name: screen.name,
            html_content: screen.html,
            sort_order: sortOrder,
          });
      }
    } catch (error) {
      console.error("Error saving screen to database:", error);
    }
  }, [supabase, projectId]);

  // Handle when a single screen completes during streaming
  const handleScreenComplete = useCallback(async (screen: ParsedScreen) => {
    console.log("[DesignPage] Screen completed, saving to DB:", screen.name);
    // Use ref for sort order to avoid stale closure
    const sortOrder = screenCountRef.current;
    screenCountRef.current += 1;
    // Save to database
    await saveScreenToDatabase(screen, sortOrder);
    // Update state
    setCompletedScreens((prev) => [...prev, screen]);
  }, [saveScreenToDatabase]);

  const handleStreamComplete = useCallback((screens: ParsedScreen[]) => {
    setIsStreaming(false);
    setStreamedScreens(screens);
    setStreamingPrompt("");
    // Note: screens are already added via handleScreenComplete, so we don't add again

    // Update the last assistant message
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
        const screenNames = screens.map((s) => s.name).join(", ");
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content:
            screens.length === 1
              ? `Design generated! The "${screens[0].name}" screen is now displayed.`
              : `Design generated! ${screens.length} screens created: ${screenNames}.`,
        };
      }
      return newMessages;
    });
  }, []);

  const handleStreamError = useCallback((errorMsg: string) => {
    setIsStreaming(false);
    setStreamingPrompt("");

    // Update the last assistant message
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: `Sorry, something went wrong: ${errorMsg}. Please try again.`,
        };
      }
      return newMessages;
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim() || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // Start streaming for the new request
    startDesignGeneration(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyAll = async () => {
    if (completedScreens.length === 0) return;
    try {
      const allHtml = completedScreens
        .map((screen) => `<!-- Screen: ${screen.name} -->\n${screen.html}`)
        .join("\n\n");
      await navigator.clipboard.writeText(allHtml);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error("Failed to copy all:", err);
    }
  };

  const handleContinueToBuild = async () => {
    if (!project || completedScreens.length === 0) return;

    setIsSaving(true);
    try {
      // Delete existing designs for this project (in case of re-generation)
      await supabase
        .from("project_designs")
        .delete()
        .eq("project_id", projectId);

      // Save all completed screens to database
      const designsToInsert: DesignInsert[] = completedScreens.map((screen, index) => ({
        project_id: projectId,
        screen_name: screen.name,
        html_content: screen.html,
        sort_order: index,
      }));

      const { error: insertError } = await supabase
        .from("project_designs")
        .insert(designsToInsert);

      if (insertError) {
        console.error("Error saving designs:", insertError);
        throw insertError;
      }

      // Update project design_completed_at
      const { error: projectError } = await supabase
        .from("projects")
        .update({ design_completed_at: new Date().toISOString() })
        .eq("id", projectId);

      if (projectError) {
        console.error("Error updating project:", projectError);
        throw projectError;
      }

      // Navigate to build page
      router.push(`/home/projects/build/${projectId}`);
    } catch (error) {
      console.error("Error continuing to build:", error);
      setIsSaving(false);
    }
  };

  const handleSkipToBuild = async () => {
    if (!project) return;

    setIsSaving(true);
    try {
      // Update project design_completed_at (even without designs)
      const { error: projectError } = await supabase
        .from("projects")
        .update({ design_completed_at: new Date().toISOString() })
        .eq("id", projectId);

      if (projectError) {
        console.error("Error updating project:", projectError);
        throw projectError;
      }

      // Navigate to build page
      router.push(`/home/projects/build/${projectId}`);
    } catch (error) {
      console.error("Error skipping to build:", error);
      setIsSaving(false);
    }
  };

  if (loading) {
    return <DesignPageSkeleton />;
  }

  if (!project) {
    return null;
  }

  const includedFeatures = features.filter((f) => f.is_included);

  return (
    <div className="flex flex-col h-full relative">
      {/* Gradient orbs background */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1400px] h-[900px] opacity-25 dark:opacity-10 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-violet-300/50 dark:bg-violet-500/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-cyan-300/40 dark:bg-cyan-500/15 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-fuchsia-300/30 dark:bg-fuchsia-500/10 rounded-full blur-[100px]" />
        </div>
      </div>

      <ProjectHeader projectId={project.id} projectName={project.name} />

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Chat */}
          <ResizablePanel defaultSize={32} minSize={25} maxSize={40}>
            <div className="h-full flex flex-col bg-background/60 backdrop-blur-md border-r border-border/50 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 && !isStreaming ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8 py-12">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-3xl blur-xl" />
                      <div className="relative w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-500/20">
                        <Wand2 className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-3">
                      Creating Your Design
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mb-6">
                      We&apos;re generating beautiful screens based on your app idea
                      {includedFeatures.length > 0 && ` and ${includedFeatures.length} features`}.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI-powered design generation</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-3",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === "assistant" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/20">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-3",
                            message.role === "user"
                              ? "bg-foreground text-background"
                              : "bg-card/80 backdrop-blur-sm border border-border/50 text-foreground shadow-sm"
                          )}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                        {message.role === "user" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isStreaming && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/20">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                          <div className="flex gap-1.5">
                            <div
                              className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-fuchsia-500 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Generated Screens Pills */}
              {completedScreens.length > 0 && (
                <div className="flex-shrink-0 border-t border-border/50 px-4 py-3 bg-card/30 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {completedScreens.length} screen{completedScreens.length !== 1 ? "s" : ""} generated
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {completedScreens.map((screen, index) => (
                      <div
                        key={index}
                        className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-700 dark:text-violet-300 border border-violet-200/50 dark:border-violet-500/20"
                      >
                        {screen.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="flex-shrink-0 border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe changes or add more screens..."
                      rows={1}
                      className={cn(
                        "w-full resize-none bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3",
                        "text-sm text-foreground placeholder:text-muted-foreground/60",
                        "focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50",
                        "transition-all duration-200"
                      )}
                      disabled={isStreaming}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isStreaming || !inputValue.trim()}
                    className={cn(
                      "rounded-xl px-4 h-[46px]",
                      "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600",
                      "shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30",
                      "transition-all duration-200"
                    )}
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-px bg-border/50 hover:bg-violet-500/50 transition-colors data-[resize-handle-active]:bg-violet-500" />

          {/* Right Panel - Canvas */}
          <ResizablePanel defaultSize={68}>
            <div className="h-full w-full relative overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
              {/* Subtle grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.3) 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }}
              />

              {/* Canvas label and Copy All button - floating together */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500",
                      isStreaming && "animate-pulse"
                    )} />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {isStreaming ? "Generating..." : "Preview"}
                    </span>
                  </div>
                </div>

                {/* Copy All Button - next to Preview */}
                {completedScreens.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAll}
                    className="h-8 px-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:bg-white dark:hover:bg-slate-700 gap-2"
                  >
                    {copiedAll ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Files className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs font-medium">
                      {copiedAll ? "Copied!" : `Copy All (${completedScreens.length})`}
                    </span>
                  </Button>
                )}
              </div>

              <DesignCanvas
                screens={[]}
                theme={{
                  primary: "#8b5cf6",
                  secondary: "#d946ef",
                  background: "#ffffff",
                  foreground: "#1e293b",
                  accent: "#a855f7",
                  cssVariables:
                    ":root { --primary: #8b5cf6; --secondary: #d946ef; --background: #ffffff; --foreground: #1e293b; --accent: #a855f7; }",
                }}
                isStreaming={isStreaming}
                streamingPrompt={streamingPrompt}
                streamingScreenName="Preview"
                features={includedFeatures.map((f) => ({
                  title: f.title,
                  description: f.description,
                  is_included: f.is_included,
                }))}
                streamedScreens={streamedScreens}
                onStreamComplete={handleStreamComplete}
                onScreenComplete={handleScreenComplete}
                onStreamError={handleStreamError}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Sticky Footer */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Progress */}
            <div className="flex items-center gap-3">
              {isStreaming ? (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="relative">
                    <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-md" />
                    <Loader2 className="relative h-4 w-4 animate-spin text-violet-500" />
                  </div>
                  <span>Generating design...</span>
                </div>
              ) : completedScreens.length > 0 ? (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <Layers className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {completedScreens.length}
                    </span>{" "}
                    screen{completedScreens.length !== 1 ? "s" : ""} ready
                  </span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Waiting for design...
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSkipToBuild}
                disabled={isSaving}
                className={cn(
                  "text-sm text-muted-foreground hover:text-foreground",
                  "flex items-center gap-1.5 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <SkipForward className="h-3.5 w-3.5" />
                <span>Skip to Build</span>
              </button>

              <Button
                onClick={handleContinueToBuild}
                disabled={isSaving || isStreaming || completedScreens.length === 0}
                className={cn(
                  "rounded-full px-6 h-10 font-semibold",
                  "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600",
                  "shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30",
                  "hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Build with this Design</span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
