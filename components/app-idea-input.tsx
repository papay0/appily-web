"use client";

import { useCallback } from "react";
import { UnifiedInput } from "@/components/unified-input";
import type { AIProvider } from "@/components/ai-provider-selector";

interface AppIdeaInputProps {
  onSubmit: (idea: string, planFeatures: boolean, imageKeys: string[], tempUploadId: string) => void;
  isLoading: boolean;
  planFeatures: boolean;
  onPlanFeaturesChange: (checked: boolean) => void;
  tempUploadId: string;
  onTempUploadIdReady: (id: string) => void;
  aiProvider: AIProvider;
  onAIProviderChange: (provider: AIProvider) => void;
}

export function AppIdeaInput({
  onSubmit,
  isLoading,
  planFeatures,
  onPlanFeaturesChange,
  tempUploadId,
  onTempUploadIdReady,
  aiProvider,
  onAIProviderChange,
}: AppIdeaInputProps) {
  const handleSubmit = useCallback(
    (text: string, imageKeys: string[]) => {
      onSubmit(text, planFeatures, imageKeys, tempUploadId);
    },
    [planFeatures, tempUploadId, onSubmit]
  );

  return (
    <UnifiedInput
      variant="home"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      showPlanCheckbox
      planFeatures={planFeatures}
      onPlanFeaturesChange={onPlanFeaturesChange}
      onTempUploadIdReady={onTempUploadIdReady}
      aiProvider={aiProvider}
      onAIProviderChange={onAIProviderChange}
    />
  );
}
