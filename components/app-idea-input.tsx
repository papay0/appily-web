"use client";

import { useCallback } from "react";
import { UnifiedInput, type StartMode } from "@/components/unified-input";
import type { AIProvider } from "@/components/ai-provider-selector";

interface AppIdeaInputProps {
  onSubmit: (idea: string, startMode: StartMode, imageKeys: string[], tempUploadId: string, useConvex: boolean) => void;
  isLoading: boolean;
  startMode: StartMode;
  onStartModeChange: (mode: StartMode) => void;
  tempUploadId: string;
  onTempUploadIdReady: (id: string) => void;
  aiProvider: AIProvider;
  onAIProviderChange: (provider: AIProvider) => void;
  useConvex: boolean;
  onUseConvexChange: (enabled: boolean) => void;
}

export function AppIdeaInput({
  onSubmit,
  isLoading,
  startMode,
  onStartModeChange,
  tempUploadId,
  onTempUploadIdReady,
  aiProvider,
  onAIProviderChange,
  useConvex,
  onUseConvexChange,
}: AppIdeaInputProps) {
  const handleSubmit = useCallback(
    (text: string, imageKeys: string[]) => {
      onSubmit(text, startMode, imageKeys, tempUploadId, useConvex);
    },
    [startMode, tempUploadId, useConvex, onSubmit]
  );

  return (
    <UnifiedInput
      variant="home"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      showStartModeSelector
      startMode={startMode}
      onStartModeChange={onStartModeChange}
      onTempUploadIdReady={onTempUploadIdReady}
      aiProvider={aiProvider}
      onAIProviderChange={onAIProviderChange}
      useConvex={useConvex}
      onUseConvexChange={onUseConvexChange}
    />
  );
}
