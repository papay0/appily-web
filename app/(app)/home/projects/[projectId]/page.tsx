"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useSession } from "@clerk/nextjs";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSupabaseClient } from "@/lib/supabase-client";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { CodeEditor } from "@/components/code-editor";
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

type Project = {
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
  const [isSaving, setIsSaving] = useState(false);

  // Load project and setup realtime subscription
  useEffect(() => {
    // Wait for both user and Clerk session to be fully loaded
    if (!user || !isLoaded) return;

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
              // Clear old QR code and Expo URL from UI
              setExpoUrl(undefined);
              setQrCode(undefined);
            }
          } catch (error) {
            console.error("Failed to reconnect to sandbox:", error);
            setSandboxStatus("idle");
            // Clear old QR code and Expo URL from UI
            setExpoUrl(undefined);
            setQrCode(undefined);
          } finally {
            setIsReconnecting(false);
          }
        } else {
          setSandboxStatus("idle");
        }

        setLoading(false);

      } catch (error) {
        console.error("Error setting up project subscription:", error);
        router.push("/home");
      }
    }

    setupProjectSubscription();
  }, [user, projectId, router, isLoaded, supabase]);

  // Uptime counter
  useEffect(() => {
    if (sandboxStatus !== "ready") return;

    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sandboxStatus]);

  // Fetch latest project data (used on reconnect)
  const fetchProjectData = useCallback(async () => {
    console.log(`[ProjectPage] 📥 Fetching latest project data...`);
    const { data: latestProject, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) {
      console.error("[ProjectPage] Failed to fetch project data:", error);
    } else if (latestProject) {
      console.log("[ProjectPage] Latest project data fetched");
      setProject(latestProject);

      // Update all state from latest data
      if (latestProject.expo_url) setExpoUrl(latestProject.expo_url);
      if (latestProject.qr_code) setQrCode(latestProject.qr_code);
      if (latestProject.e2b_sandbox_status) {
        setSandboxStatus(latestProject.e2b_sandbox_status as SandboxStatus);
      }
      if (latestProject.e2b_sandbox_status === "ready" && latestProject.e2b_sandbox_created_at) {
        const createdAt = new Date(latestProject.e2b_sandbox_created_at);
        const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 1000);
        setUptime(elapsed);
      }
    }
  }, [projectId, supabase]);

  // Handle realtime project updates
  const handleProjectUpdate = useCallback((payload: RealtimePostgresChangesPayload<Project>) => {
    const updatedProject = payload.new as Project | null;
    if (!updatedProject) return;

    console.log(`[ProjectPage] 📨 Project UPDATE received:`, {
      projectId: updatedProject.id,
      e2b_sandbox_status: updatedProject.e2b_sandbox_status,
      has_expo_url: !!updatedProject.expo_url,
      has_qr_code: !!updatedProject.qr_code,
      has_session_id: !!updatedProject.session_id,
      timestamp: new Date().toISOString()
    });

    setProject(updatedProject);

    // Sync sandbox status from database
    if (updatedProject.e2b_sandbox_status) {
      setSandboxStatus(updatedProject.e2b_sandbox_status as SandboxStatus);
    } else {
      setSandboxStatus("idle");
    }

    // Update Expo URL and QR code from database
    if (updatedProject.expo_url) setExpoUrl(updatedProject.expo_url);
    if (updatedProject.qr_code) setQrCode(updatedProject.qr_code);

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
  }, []);

  // Handle subscription errors
  const handleSubscriptionError = useCallback((error: Error) => {
    console.error("[ProjectPage] ❌ Subscription error:", error);
    setSandboxError("Connection lost. Please refresh the page.");
  }, []);

  // Subscribe to project updates with auto-reconnection
  const { status: projectChannelStatus } = useRealtimeSubscription<Project>({
    channelKey: `projects:${projectId}`,
    table: "projects",
    event: "UPDATE",
    filter: `id=eq.${projectId}`,
    onEvent: handleProjectUpdate,
    onError: handleSubscriptionError,
    enabled: isLoaded,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (projectChannelStatus === "connected") {
      fetchProjectData();
    }
  }, [projectChannelStatus, fetchProjectData, isLoaded]);

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

      // Clear QR code and Expo URL (no longer valid after stopping)
      // New ones will be generated when sandbox is restarted
      setExpoUrl(undefined);
      setQrCode(undefined);
      // Status will be updated via realtime subscription
    } catch (error) {
      console.error("Failed to stop sandbox:", error);
      setSandboxError(error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Debug: Manual save to R2
  const handleSaveToR2 = async () => {
    if (!project?.id) return;

    setIsSaving(true);
    try {
      console.log("[ProjectPage] Manually saving project to R2...");
      const response = await fetch(`/api/projects/${project.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Manual save from debug button",
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("[ProjectPage] ✓ Project saved:", data.snapshot);
        alert(`✅ Saved successfully!\nVersion: ${data.snapshot.version}\nFiles: ${data.snapshot.fileCount}\nSize: ${(data.snapshot.totalSize / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.error("[ProjectPage] ✗ Save failed:", data.error);
        alert(`❌ Save failed: ${data.error}`);
      }
    } catch (error) {
      console.error("[ProjectPage] ✗ Save request failed:", error);
      alert(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header Skeleton */}
        <div className="border-b px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </div>

        {/* Two-Panel Layout Skeleton */}
        <div className="flex-1 min-h-0 flex">
          {/* Left Panel - Chat Skeleton */}
          <div className="w-[30%] border-r flex flex-col">
            <div className="flex-1 overflow-hidden p-4 space-y-4">
              {/* Message skeletons */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Input area skeleton */}
            <div className="border-t p-4">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Right Panel - Preview Skeleton */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-900 dark:via-blue-950/20 dark:to-purple-950/20 p-6">
            <div className="text-center space-y-6">
              {/* iPhone frame skeleton */}
              <div className="mx-auto">
                <Skeleton className="w-[320px] h-[640px] rounded-[3rem]" />
              </div>
              {/* Text skeleton */}
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          </div>
        </div>
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
        onSaveToR2={handleSaveToR2}
        isSaving={isSaving}
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
