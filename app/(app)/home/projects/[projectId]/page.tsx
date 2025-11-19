"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
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
}

export default function ProjectPage() {
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

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // Load project and setup realtime subscription
  useEffect(() => {
    if (!user) return;

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
        channel = supabase
          .channel(`project:${projectId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "projects",
              filter: `id=eq.${projectId}`,
            },
            (payload) => {
              const updatedProject = payload.new as Project;
              setProject(updatedProject);

              // Sync sandbox status from database
              if (updatedProject.e2b_sandbox_status) {
                setSandboxStatus(updatedProject.e2b_sandbox_status as SandboxStatus);
              } else {
                setSandboxStatus("idle");
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
          .subscribe();
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
  }, [user, projectId, router]);

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

      // Status will be updated via realtime subscription
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
    <>
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
      <div className="flex-1 -mx-4 -mb-4">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Chat */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <ChatPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Preview/Code */}
          <ResizablePanel defaultSize={70}>
            <div className="h-full overflow-hidden">
              {viewMode === "preview" ? (
                <PreviewPanel
                  sandboxStatus={sandboxStatus}
                  onStartSandbox={handleStartSandbox}
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
    </>
  );
}
