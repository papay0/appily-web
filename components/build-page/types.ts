import type { Feature } from "@/lib/types/features";
import type { HealthStatus } from "@/app/api/sandbox/health/route";

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

  // Health status for overlay
  healthStatus?: HealthStatus | null;
  healthMessage?: string;

  // View mode (desktop only)
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}
