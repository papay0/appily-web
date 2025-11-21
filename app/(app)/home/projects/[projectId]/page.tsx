"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useSession } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { CodeEditor } from "@/components/code-editor";
import { SegmentedControl } from "@/components/segmented-control";
import { DebugPanel } from "@/components/debug-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/project-header";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

type ViewMode = "preview" | "code";
type SandboxStatus = "idle" | "starting" | "ready" | "error";

interface Project {
  id: string;
  name: string;
  user_id: string;
  e2b_sandbox_id: string | null;
  e2b_sandbox_status: "idle" | "starting" | "ready" | "error" | null;
  e2b_sandbox_created_at: string | null;
  expo_url: string | null;
  qr_code: string | null;
  session_id: string | null;
}

export default function ProjectPage() {
  const { isLoaded } = useSession();
  const supabase = useSupabaseClient();
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const projectId = params.projectId as string;

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // E2B state (now synced from database via realtime)
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>("idle");
  const [sandboxError, setSandboxError] = useState<string>();
  const [uptime, setUptime] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [expoUrl, setExpoUrl] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // Load project and setup realtime subscription
  useEffect(() => {
    // Wait for both user and Clerk session to be fully loaded
    if (!user || !isLoaded) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupProjectSubscription() {
      try {
        if (!user) return;

        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!userData) {
          router.push("/home");
          return;
        }

        // Initial load
        const { data: projectData, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("user_id", userData.id)
          .single();

        if (error || !projectData) {
          router.push("/home");
          return;
        }

        setProject(projectData);

        // Set initial Expo URL and QR code from database
        if (projectData.expo_url) {
          setExpoUrl(projectData.expo_url);
        }
        if (projectData.qr_code) {
          setQrCode(projectData.qr_code);
        }

        // Set initial sandbox status from database
        if (projectData.e2b_sandbox_id && projectData.e2b_sandbox_status) {
          // Try to reconnect to existing sandbox
          setIsReconnecting(true);
          setSandboxStatus("starting");

          try {
            const response = await fetch("/api/sandbox/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sandboxId: projectData.e2b_sandbox_id }),
            });

            const data = await response.json();

            if (data.connected) {
              setSandboxStatus("ready");
              // Calculate uptime
              if (projectData.e2b_sandbox_created_at) {
                const createdAt = new Date(projectData.e2b_sandbox_created_at);
                const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 1000);
                setUptime(elapsed);
              }
            } else {
              // Sandbox died, clear from database
              await fetch("/api/sandbox/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sandboxId: projectData.e2b_sandbox_id,
                  projectId: projectData.id
                }),
              });
              setSandboxStatus("idle");
            }
          } catch (error) {
            console.error("Failed to reconnect to sandbox:", error);
            setSandboxStatus("idle");
          } finally {
            setIsReconnecting(false);
          }
        } else {
          setSandboxStatus("idle");
        }

        setLoading(false);

        // Subscribe to realtime changes
        const subscriptionConfig = {
          channel: `project:${projectId}`,
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
          timestamp: new Date().toISOString()
        };
        console.log(`[ProjectPage] 🔌 Setting up projects table subscription:`, subscriptionConfig);

        channel = supabase
          .channel(subscriptionConfig.channel)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "projects",
              filter: subscriptionConfig.filter,
            },
            (payload) => {
              const updatedProject = payload.new as Project;

              console.log(`[ProjectPage] 📨 Project UPDATE received:`, {
                projectId: updatedProject.id,
                e2b_sandbox_status: updatedProject.e2b_sandbox_status,
                has_expo_url: !!updatedProject.expo_url,
                has_qr_code: !!updatedProject.qr_code,
                has_session_id: !!updatedProject.session_id,
                timestamp: new Date().toISOString()
              });

              // Detailed logging of what changed
              const changes: string[] = [];
              if (updatedProject.expo_url && updatedProject.expo_url !== expoUrl) {
                changes.push(`expo_url: ${updatedProject.expo_url}`);
              }
              if (updatedProject.qr_code && updatedProject.qr_code !== qrCode) {
                changes.push("qr_code: updated");
              }
              if (updatedProject.e2b_sandbox_status !== sandboxStatus) {
                changes.push(`status: ${updatedProject.e2b_sandbox_status}`);
              }

              if (changes.length > 0) {
                console.log(`[ProjectPage] 📝 Changes detected:`, changes);
              }

              setProject(updatedProject);

              // Sync sandbox status from database
              if (updatedProject.e2b_sandbox_status) {
                setSandboxStatus(updatedProject.e2b_sandbox_status as SandboxStatus);
              } else {
                setSandboxStatus("idle");
              }

              // Update Expo URL and QR code from database
              if (updatedProject.expo_url) {
                setExpoUrl(updatedProject.expo_url);
              }
              if (updatedProject.qr_code) {
                setQrCode(updatedProject.qr_code);
              }

              // Reset uptime when sandbox starts
              if (updatedProject.e2b_sandbox_status === "ready" && updatedProject.e2b_sandbox_created_at) {
                const createdAt = new Date(updatedProject.e2b_sandbox_created_at);
                const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 1000);
                setUptime(elapsed);
              }

              // Clear uptime when sandbox stops
              if (!updatedProject.e2b_sandbox_id) {
                setUptime(0);
              }
            }
          )
          .subscribe((status, err) => {
            console.log(`[ProjectPage] 🔄 Subscription status:`, {
              status,
              timestamp: new Date().toISOString(),
              error: err ? JSON.stringify(err, null, 2) : null
            });

            if (status === "SUBSCRIBED") {
              console.log("[ProjectPage] ✅ Successfully subscribed to projects table");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              console.error(`[ProjectPage] ❌ Subscription failed:`, {
                status,
                error: err,
                errorMessage: err?.message,
                errorDetails: JSON.stringify(err, null, 2)
              });
              console.error(`[ProjectPage] ℹ️ Refresh the page to reconnect`);
            }
          });

      } catch (error) {
        console.error("Error setting up project subscription:", error);
        router.push("/home");
      }
    }

    setupProjectSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, projectId, router, isLoaded]);

  // Uptime counter
  useEffect(() => {
    if (sandboxStatus !== "ready") return;

    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sandboxStatus]);

  const handleStartSandbox = async () => {
    if (!project) return;

    setSandboxStatus("starting");
    setSandboxError(undefined);

    try {
      const response = await fetch("/api/sandbox/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create sandbox");
      }

      // Status, Expo URL, and QR code will be updated via realtime subscription
      // as the background setup completes
    } catch (error) {
      console.error("Failed to create sandbox:", error);
      setSandboxStatus("error");
      setSandboxError(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleStopSandbox = async () => {
    if (!project || !project.e2b_sandbox_id) return;

    try {
      await fetch("/api/sandbox/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: project.e2b_sandbox_id,
          projectId: project.id,
        }),
      });

      // Clear QR code and Expo URL when stopping sandbox
      setExpoUrl(undefined);
      setQrCode(undefined);

      // Status will be updated via realtime subscription
    } catch (error) {
      console.error("Failed to stop sandbox:", error);
      setSandboxError(error instanceof Error ? error.message : "Unknown error");
    }
  };


  if (loading) {
    return (
      <div className="h-full w-full p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Unified Header */}
      <ProjectHeader
        projectName={project.name}
        viewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode)}
        sandboxStatus={isReconnecting ? "starting" : sandboxStatus}
        onStartSandbox={handleStartSandbox}
        onStopSandbox={handleStopSandbox}
      />

      {/* Resizable 2-Panel Layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Chat */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <ChatPanel
              projectId={projectId}
              sandboxId={project.e2b_sandbox_id || undefined}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Preview/Code */}
          <ResizablePanel defaultSize={70}>
            <div className="h-full overflow-hidden">
              {viewMode === "preview" ? (
                <PreviewPanel
                  sandboxStatus={sandboxStatus}
                  onStartSandbox={handleStartSandbox}
                  expoUrl={expoUrl}
                  qrCode={qrCode}
                  sandboxId={project.e2b_sandbox_id || undefined}
                  projectId={projectId}
                />
              ) : (
                <CodeEditor />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Debug Panel */}
      <DebugPanel
        sandboxId={project.e2b_sandbox_id || undefined}
        sandboxStatus={sandboxStatus}
        uptime={uptime}
        error={sandboxError}
      />
    </div>
  );
}
