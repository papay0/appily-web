"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { AppIdeaInput } from "@/components/app-idea-input";
import { RecentProjectsSection } from "@/components/recent-projects-section";
import type { AIProvider } from "@/components/ai-provider-selector";
import type { StartMode } from "@/components/unified-input";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [startMode, setStartMode] = useState<StartMode>("plan");
  const [tempUploadId, setTempUploadId] = useState<string>("");
  const [aiProvider, setAIProvider] = useState<AIProvider>("claude-sdk");
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [useConvex, setUseConvex] = useState<boolean>(false);
  const greeting = getGreeting();

  useEffect(() => {
    async function loadUserDataAndProjects() {
      if (!user) return;

      try {
        // Get user data from Supabase (including AI provider preference)
        const { data: userData } = await supabase
          .from("users")
          .select("id, ai_provider")
          .eq("clerk_id", user.id)
          .single();

        if (!userData) return;

        setSupabaseUserId(userData.id);

        // Set AI provider from user preference
        // Note: "claude" (CLI) is legacy, we now default to "claude-sdk"
        if (userData.ai_provider) {
          if (userData.ai_provider === "gemini") {
            setAIProvider("gemini");
          }
          // "claude" and "claude-sdk" both map to "claude-sdk" (the new default)
          // No action needed as state is already "claude-sdk"
        }

        // Fetch user's projects
        const { data: projectsData } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", userData.id)
          .order("updated_at", { ascending: false });

        setProjects(projectsData || []);
      } catch (error) {
        console.error("Error loading user data and projects:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserDataAndProjects();
  }, [user, supabase]);

  // Save AI provider preference to Supabase when it changes
  const handleAIProviderChange = useCallback(
    async (provider: AIProvider) => {
      setAIProvider(provider);

      // Save to Supabase if user is logged in
      if (supabaseUserId) {
        try {
          await supabase
            .from("users")
            .update({ ai_provider: provider })
            .eq("id", supabaseUserId);
        } catch (error) {
          console.error("Error saving AI provider preference:", error);
        }
      }
    },
    [supabase, supabaseUserId]
  );

  const handleCreateProject = async (
    appIdea: string,
    selectedStartMode: StartMode,
    imageKeys: string[],
    tempUploadId: string,
    shouldUseConvex: boolean
  ) => {
    if (!user) return;
    setIsCreating(true);

    try {
      // 1. Get Supabase user ID
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", user.id)
        .single();

      if (!userData) throw new Error("User not found");

      // 2. Determine which timestamps to set based on start mode
      const now = new Date().toISOString();
      const timestamps: { planning_completed_at?: string; design_completed_at?: string } = {};

      if (selectedStartMode === "design") {
        // Skip planning, go to design
        timestamps.planning_completed_at = now;
      } else if (selectedStartMode === "build") {
        // Skip both planning and design
        timestamps.planning_completed_at = now;
        timestamps.design_completed_at = now;
      }
      // For "plan" mode, no timestamps are set

      // 3. Create project with appropriate timestamps
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: "New Project", // Placeholder - will be generated async on build page
          user_id: userData.id,
          app_idea: appIdea,
          ai_provider: aiProvider,
          use_convex: shouldUseConvex,
          ...timestamps,
        })
        .select()
        .single();

      if (error) throw error;

      // 4. Link temp images to project (if any)
      if (imageKeys.length > 0 && tempUploadId) {
        try {
          const linkResponse = await fetch("/api/images/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tempUploadId,
              projectId: project.id,
            }),
          });

          if (linkResponse.ok) {
            const linkData = await linkResponse.json();
            console.log(`Linked ${linkData.newKeys?.length || 0} images to project ${project.id}`);
          }
        } catch (linkError) {
          console.error("Failed to link images:", linkError);
          // Continue anyway - images are not critical
        }
      }

      // 5. Navigate to appropriate page based on start mode
      switch (selectedStartMode) {
        case "plan":
          router.push(`/home/projects/plan/${project.id}`);
          break;
        case "design":
          router.push(`/home/projects/design/${project.id}`);
          break;
        case "build":
          router.push(`/home/projects/build/${project.id}`);
          break;
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* ============================================
          AMBIENT BACKGROUND
          ============================================ */}
      <div className="fixed inset-0 -z-10 bg-background">
        {/* Soft gradient orbs - marketing page style */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] opacity-40 dark:opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-200/50 dark:bg-orange-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-200/50 dark:bg-blue-500/20 rounded-full blur-[120px]" />
        </div>
      </div>

      {/* ============================================
          MAIN CONTENT
          ============================================ */}
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-2xl mx-auto">
          {/* Greeting with time-based message */}
          <div className="animate-fade-in-up opacity-0 animation-delay-200">
            <span className="text-lg text-muted-foreground mb-4">
              {greeting}
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display text-foreground mb-6 animate-fade-in-up opacity-0 animation-delay-400">
            What will you{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                build
              </span>
              <svg
                className="absolute w-full h-3 -bottom-1 left-0 text-primary/30 dark:text-primary/40"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
              >
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>{" "}
            today?
          </h1>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-muted-foreground animate-fade-in-up opacity-0 animation-delay-600">
            Describe your idea and watch AI bring it to life
          </p>
        </div>

        {/* App Idea Input */}
        <div className="w-full max-w-2xl animate-scale-fade-in opacity-0 animation-delay-800">
          <AppIdeaInput
            onSubmit={handleCreateProject}
            isLoading={isCreating}
            startMode={startMode}
            onStartModeChange={setStartMode}
            tempUploadId={tempUploadId}
            onTempUploadIdReady={setTempUploadId}
            aiProvider={aiProvider}
            onAIProviderChange={handleAIProviderChange}
            useConvex={useConvex}
            onUseConvexChange={setUseConvex}
          />
        </div>

        {/* Recent Projects */}
        <div className="w-full animate-fade-in-up opacity-0 animation-delay-1000">
          <RecentProjectsSection projects={projects} maxDisplay={6} loading={loading} />
        </div>
      </div>
    </div>
  );
}
