"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the ConvexDashboard component
 */
interface ConvexDashboardProps {
  /**
   * The Convex deployment URL
   * @example "https://cheerful-elephant-123.convex.cloud"
   */
  deploymentUrl: string;

  /**
   * The Convex deployment name (without .convex.cloud suffix)
   * @example "cheerful-elephant-123"
   */
  deploymentName: string;

  /**
   * The admin key (deploy key) for authentication
   * @example "project:appily:my-app|access_token_here"
   */
  adminKey: string;

  /**
   * The dashboard path to display
   * @default "data"
   * @example "data", "functions", "logs", "files", "settings"
   */
  path?: string;

  /**
   * Optional list of pages to show in the sidebar
   * If not provided, all pages are visible
   * @example ["data", "functions", "logs"]
   */
  visiblePages?: string[];

  /**
   * Optional CSS class name for the container
   */
  className?: string;
}

/**
 * Available dashboard pages
 */
const DASHBOARD_PAGES = [
  { id: "data", label: "Data", icon: Database },
  { id: "functions", label: "Functions", icon: Database },
  { id: "logs", label: "Logs", icon: Database },
  { id: "files", label: "Files", icon: Database },
  { id: "settings", label: "Settings", icon: Database },
] as const;

/**
 * ConvexDashboard - Embedded Convex dashboard component
 *
 * Embeds the Convex dashboard in an iframe and handles authentication
 * via postMessage. Users can browse data, view functions, and manage
 * their Convex deployment without leaving Appily.
 *
 * @see https://docs.convex.dev/platform-apis/embedded-dashboard
 *
 * @example
 * ```tsx
 * <ConvexDashboard
 *   deploymentUrl="https://cheerful-elephant-123.convex.cloud"
 *   deploymentName="cheerful-elephant-123"
 *   adminKey="project:appily:my-app|token"
 *   path="data"
 *   visiblePages={["data", "functions", "logs"]}
 * />
 * ```
 */
export function ConvexDashboard({
  deploymentUrl,
  deploymentName,
  adminKey,
  path = "data",
  visiblePages,
  className,
}: ConvexDashboardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(path);

  // Handle credential requests from the embedded dashboard
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only respond to dashboard credential requests
      if (event.data?.type !== "dashboard-credentials-request") {
        return;
      }

      // Send credentials to the dashboard
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "dashboard-credentials",
          adminKey,
          deploymentUrl,
          deploymentName,
          ...(visiblePages && { visiblePages }),
        },
        "*"
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [deploymentUrl, adminKey, deploymentName, visiblePages]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  // Build the dashboard URL
  const dashboardUrl = `https://dashboard-embedded.convex.dev/${currentPath}`;

  // Build the external dashboard URL (for "Open in new tab")
  const externalUrl = `https://dashboard.convex.dev/d/${deploymentName}/${currentPath}`;

  return (
    <div className={`flex h-full flex-col ${className || ""}`}>
      {/* Header with navigation and external link */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Convex Dashboard</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Page navigation tabs */}
          <div className="flex items-center gap-1">
            {DASHBOARD_PAGES.filter(
              (page) => !visiblePages || visiblePages.includes(page.id)
            ).map((page) => (
              <Button
                key={page.id}
                variant={currentPath === page.id ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCurrentPath(page.id)}
              >
                {page.label}
              </Button>
            ))}
          </div>

          {/* Open in new tab button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2"
            onClick={() => window.open(externalUrl, "_blank")}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="sr-only">Open in new tab</span>
          </Button>
        </div>
      </div>

      {/* Dashboard iframe */}
      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading dashboard...
              </span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={dashboardUrl}
          className="h-full w-full border-none bg-white"
          allow="clipboard-write"
          onLoad={handleIframeLoad}
          title="Convex Dashboard"
        />
      </div>
    </div>
  );
}

/**
 * Placeholder component shown when Convex is not connected
 */
export function ConvexDashboardPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Database className="h-12 w-12 text-muted-foreground/50" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium">No Backend Connected</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Connect a Convex backend to view and manage your app&apos;s data,
          functions, and logs.
        </p>
      </div>
      <Button variant="outline" disabled>
        Connect Convex
      </Button>
    </div>
  );
}
