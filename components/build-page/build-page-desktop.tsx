"use client";

import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { CodeEditor } from "@/components/code-editor";
import { ConvexDashboard, ConvexDashboardPlaceholder } from "@/components/convex-dashboard";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { BuildPageLayoutProps } from "./types";

export function BuildPageDesktop({
  projectId,
  sandboxId,
  featureContext,
  sandboxStatus,
  onStartSandbox,
  expoUrl,
  qrCode,
  viewMode,
  healthStatus,
  healthMessage,
  initialAiProvider,
  convexProject,
}: BuildPageLayoutProps) {
  // Render the right panel content based on view mode
  const renderRightPanel = () => {
    switch (viewMode) {
      case "preview":
        return (
          <PreviewPanel
            sandboxStatus={sandboxStatus}
            onStartSandbox={onStartSandbox}
            expoUrl={expoUrl}
            qrCode={qrCode}
            sandboxId={sandboxId}
            projectId={projectId}
            healthStatus={healthStatus}
            healthMessage={healthMessage}
          />
        );
      case "database":
        if (convexProject?.status === "connected" && convexProject.deploymentUrl && convexProject.deploymentName && convexProject.deployKey) {
          return (
            <ConvexDashboard
              deploymentUrl={convexProject.deploymentUrl}
              deploymentName={convexProject.deploymentName}
              adminKey={convexProject.deployKey}
              visiblePages={["data", "functions", "logs"]}
            />
          );
        }
        return <ConvexDashboardPlaceholder />;
      case "code":
      default:
        return <CodeEditor />;
    }
  };

  return (
    <div className="flex-1 min-h-0 hidden md:block">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Chat (40%) */}
        <ResizablePanel defaultSize={40} minSize={20} maxSize={80}>
          <ChatPanel
            projectId={projectId}
            sandboxId={sandboxId}
            featureContext={featureContext}
            initialAiProvider={initialAiProvider}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Preview/Code/Database (60%) */}
        <ResizablePanel defaultSize={60}>
          <div className="h-full overflow-hidden">
            {renderRightPanel()}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
