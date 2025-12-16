"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HealthStatus, HealthResponse } from "@/app/api/sandbox/health/route";

interface UseSandboxHealthOptions {
  projectId: string;
  sandboxId: string | null;
  enabled?: boolean;
  autoRestart?: boolean;
  // Callback when health status changes
  onStatusChange?: (status: HealthStatus) => void;
  // Callback when sandbox becomes ready
  onReady?: (expoUrl: string, qrCode: string) => void;
}

interface UseSandboxHealthResult {
  status: HealthStatus | null;
  message: string;
  isHealthy: boolean;
  isChecking: boolean;
  expoUrl?: string;
  qrCode?: string;
  checkHealth: () => Promise<void>;
  lastChecked: Date | null;
}

// Polling intervals
const HEALTHY_POLL_INTERVAL = 60000; // 60 seconds when healthy
const STARTING_POLL_INTERVAL = 5000; // 5 seconds when starting/restarting

export function useSandboxHealth({
  projectId,
  sandboxId,
  enabled = true,
  autoRestart = true,
  onStatusChange,
  onReady,
}: UseSandboxHealthOptions): UseSandboxHealthResult {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isHealthy, setIsHealthy] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [expoUrl, setExpoUrl] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Refs for cleanup and preventing stale closures
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<HealthStatus | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Health check function
  const checkHealth = useCallback(async () => {
    if (!projectId || !enabled) return;

    setIsChecking(true);

    try {
      const response = await fetch("/api/sandbox/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sandboxId,
          autoRestart,
        }),
      });

      if (!response.ok) {
        throw new Error("Health check failed");
      }

      const data: HealthResponse = await response.json();

      // Only update state if component is still mounted
      if (!isMountedRef.current) return;

      setStatus(data.status);
      setMessage(data.message);
      setIsHealthy(data.healthy);
      setLastChecked(new Date());

      if (data.expoUrl) setExpoUrl(data.expoUrl);
      if (data.qrCode) setQrCode(data.qrCode);

      // Trigger callbacks on status change
      if (data.status !== previousStatusRef.current) {
        previousStatusRef.current = data.status;
        onStatusChange?.(data.status);

        // If status changed to ready, trigger onReady callback
        if (data.status === "ready" && data.expoUrl && data.qrCode) {
          onReady?.(data.expoUrl, data.qrCode);
        }
      }
    } catch (error) {
      console.error("[useSandboxHealth] Health check error:", error);

      if (!isMountedRef.current) return;

      setStatus("error");
      setMessage("Connection issue. Retrying...");
      setIsHealthy(false);
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [projectId, sandboxId, enabled, autoRestart, onStatusChange, onReady]);

  // Setup polling
  useEffect(() => {
    isMountedRef.current = true;

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!enabled || !projectId) return;

    // Initial health check
    checkHealth();

    // Setup polling based on status
    const setupPolling = () => {
      // Clear existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Determine polling interval based on status
      const interval = isHealthy ? HEALTHY_POLL_INTERVAL : STARTING_POLL_INTERVAL;

      pollingIntervalRef.current = setInterval(() => {
        checkHealth();
      }, interval);
    };

    // Start polling
    setupPolling();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enabled, projectId, isHealthy, checkHealth]);

  // Adjust polling interval when health status changes
  useEffect(() => {
    if (!enabled || !projectId) return;

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Determine new interval based on status
    const interval = isHealthy ? HEALTHY_POLL_INTERVAL : STARTING_POLL_INTERVAL;

    console.log(
      `[useSandboxHealth] Polling interval set to ${interval}ms (healthy: ${isHealthy})`
    );

    pollingIntervalRef.current = setInterval(() => {
      checkHealth();
    }, interval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isHealthy, enabled, projectId, checkHealth]);

  return {
    status,
    message,
    isHealthy,
    isChecking,
    expoUrl,
    qrCode,
    checkHealth,
    lastChecked,
  };
}
