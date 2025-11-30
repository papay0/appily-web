"use client";

import { useState, useCallback } from "react";
import { UnifiedInput } from "@/components/unified-input";

interface AppIdeaInputProps {
  onSubmit: (idea: string, planFeatures: boolean, imageKeys: string[], tempUploadId: string) => void;
  isLoading: boolean;
}

export function AppIdeaInput({ onSubmit, isLoading }: AppIdeaInputProps) {
  const [planFeatures, setPlanFeatures] = useState(true);
  const [tempUploadId, setTempUploadId] = useState<string>("");

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
      onPlanFeaturesChange={setPlanFeatures}
      onTempUploadIdReady={setTempUploadId}
    />
  );
}
