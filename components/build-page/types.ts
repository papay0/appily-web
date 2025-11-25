import type { Feature } from "@/lib/types/features";

export type ViewMode = "preview" | "code";
export type SandboxStatus = "idle" | "starting" | "ready" | "error";

export interface BuildPageLayoutProps {
  projectId: string;
  sandboxId?: string;
  featureContext?: {
    appIdea: string;
    features: Feature[];
  };

  // Preview panel props
  sandboxStatus: SandboxStatus;
  onStartSandbox: () => void;
  expoUrl?: string;
  qrCode?: string;

  // View mode (desktop only)
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}
