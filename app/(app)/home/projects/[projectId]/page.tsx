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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit2, Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "preview" | "code";
type SandboxStatus = "idle" | "starting" | "ready" | "error";

interface Project {
  id: string;
  name: string;
  user_id: string;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const projectId = params.projectId as string;

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  // E2B state
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>("idle");
  const [sandboxError, setSandboxError] = useState<string>();
  const [uptime, setUptime] = useState(0);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  // Load project
  useEffect(() => {
    async function loadProject() {
      if (!user) return;

      try {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!userData) {
          router.push("/home");
          return;
        }

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
        setEditedName(projectData.name);
      } catch (error) {
        console.error("Error loading project:", error);
        router.push("/home");
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [user, projectId, router]);

  // Uptime counter
  useEffect(() => {
    if (sandboxStatus !== "ready") return;

    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sandboxStatus]);

  // Cleanup sandbox on unmount
  useEffect(() => {
    return () => {
      if (sandboxId) {
        fetch("/api/sandbox/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId }),
        });
      }
    };
  }, [sandboxId]);

  const handleStartSandbox = async () => {
    setSandboxStatus("starting");
    setSandboxError(undefined);
    setUptime(0);

    try {
      const response = await fetch("/api/sandbox/create", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create sandbox");
      }

      const data = await response.json();
      setSandboxId(data.sandboxId);
      setSandboxStatus("ready");
    } catch (error) {
      console.error("Failed to create sandbox:", error);
      setSandboxStatus("error");
      setSandboxError(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || !project) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: editedName.trim() })
        .eq("id", project.id);

      if (error) throw error;

      setProject({ ...project, name: editedName.trim() });
      setIsEditingName(false);
    } catch (error) {
      console.error("Error updating project name:", error);
      alert("Failed to update project name");
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
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/home")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-8"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleSaveName}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setEditedName(project.name);
                  setIsEditingName(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{project.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsEditingName(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat (30%) */}
        <div className="w-[30%] border-r">
          <ChatPanel />
        </div>

        {/* Center Panel - Preview/Code (70%) */}
        <div className="w-[70%] flex flex-col">
          {/* Segmented Control */}
          <div className="border-b p-4">
            <SegmentedControl
              options={[
                { value: "preview", label: "Preview" },
                { value: "code", label: "Code" },
              ]}
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {viewMode === "preview" ? (
              <PreviewPanel
                sandboxStatus={sandboxStatus}
                onStartSandbox={handleStartSandbox}
              />
            ) : (
              <CodeEditor />
            )}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel
        sandboxId={sandboxId || undefined}
        sandboxStatus={sandboxStatus}
        uptime={uptime}
        error={sandboxError}
      />
    </div>
  );
}
