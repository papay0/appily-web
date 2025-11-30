"use client";

import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { CodeEditor } from "@/components/code-editor";
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
}: BuildPageLayoutProps) {
  return (
    <div className="flex-1 min-h-0 hidden md:block">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Chat */}
        <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
          <ChatPanel
            projectId={projectId}
            sandboxId={sandboxId}
            featureContext={featureContext}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Preview/Code */}
        <ResizablePanel defaultSize={50}>
          <div className="h-full overflow-hidden">
            {viewMode === "preview" ? (
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
            ) : (
              <CodeEditor />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
