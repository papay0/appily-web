import type { Feature } from "@/lib/types/features";
import type { HealthStatus } from "@/app/api/sandbox/health/route";
import type { AIProvider } from "@/lib/agent/flows";

export type ViewMode = "preview" | "code";
export type SandboxStatus = "idle" | "starting" | "ready" | "error";

export interface BuildPageLayoutProps {
  projectId: string;
  sandboxId?: string;
  featureContext?: {
    appIdea: string;
    features: Feature[];
    imageKeys?: string[];
  };

  // Preview panel props
  sandboxStatus: SandboxStatus;
  onStartSandbox: () => void;
  expoUrl?: string;
  qrCode?: string;

  // Health status for overlay
  healthStatus?: HealthStatus | null;
  healthMessage?: string;

  // View mode (desktop only)
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  // AI Provider (for ChatPanel initialization)
  initialAiProvider?: AIProvider;
}
