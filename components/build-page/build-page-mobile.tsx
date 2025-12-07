"use client";

import { ChatPanel } from "@/components/chat-panel";
import { QrCodeSheet } from "@/components/qr-code-sheet";
import type { BuildPageLayoutProps } from "./types";

interface BuildPageMobileProps extends Omit<BuildPageLayoutProps, "viewMode" | "onViewModeChange"> {
  qrSheetOpen: boolean;
  onQrSheetOpenChange: (open: boolean) => void;
}

export function BuildPageMobile({
  projectId,
  sandboxId,
  featureContext,
  sandboxStatus,
  onStartSandbox,
  expoUrl,
  qrCode,
  qrSheetOpen,
  onQrSheetOpenChange,
  healthStatus,
  healthMessage,
  initialAiProvider,
}: BuildPageMobileProps) {
  return (
    <>
      {/* Mobile Layout: Chat only */}
      <div className="flex-1 min-h-0 md:hidden">
        <ChatPanel
          projectId={projectId}
          sandboxId={sandboxId}
          featureContext={featureContext}
          initialAiProvider={initialAiProvider}
        />
      </div>

      {/* Mobile: QR Code Sheet */}
      <QrCodeSheet
        open={qrSheetOpen}
        onOpenChange={onQrSheetOpenChange}
        qrCode={qrCode}
        expoUrl={expoUrl}
        healthStatus={healthStatus}
        healthMessage={healthMessage}
        onStartPreview={onStartSandbox}
        isStarting={sandboxStatus === "starting"}
      />
    </>
  );
}
