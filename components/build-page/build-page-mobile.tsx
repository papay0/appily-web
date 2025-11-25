"use client";

import { useState } from "react";
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
  expoUrl,
  qrCode,
  qrSheetOpen,
  onQrSheetOpenChange,
}: BuildPageMobileProps) {
  return (
    <>
      {/* Mobile Layout: Chat only */}
      <div className="flex-1 min-h-0 md:hidden">
        <ChatPanel
          projectId={projectId}
          sandboxId={sandboxId}
          featureContext={featureContext}
        />
      </div>

      {/* Mobile: QR Code Sheet */}
      <QrCodeSheet
        open={qrSheetOpen}
        onOpenChange={onQrSheetOpenChange}
        qrCode={qrCode}
        expoUrl={expoUrl}
      />
    </>
  );
}
