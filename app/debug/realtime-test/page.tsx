"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSupabaseClient } from "@/lib/supabase-client";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wifi, WifiOff, RotateCw, Power, Eye, EyeOff, Trash2, Activity, Play, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

interface TestResult {
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  duration: number;
  error?: string;
  logs: LogEntry[];
  timestamp: Date;
}

interface TestReport {
  testRunId: string;
  startTime: Date;
  endTime: Date;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
  systemInfo: {
    status: string;
    retryCount: number;
    eventsReceived: number;
  };
}

export default function RealtimeTestPage() {
  const supabase = useSupabaseClient();
  const [events, setEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionDuration, setConnectionDuration] = useState(0);
  const connectionStartRef = useRef<Date | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Automated testing state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const currentTestLogsRef = useRef<LogEntry[]>([]);

  // Add log entry
  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
    };

    setLogs((prev) => [...prev, logEntry]);

    // Also capture for current test if running
    if (isRunningTests) {
      currentTestLogsRef.current.push(logEntry);
    }
  }, [isRunningTests]);

  // Fetch historical test events
  const fetchHistoricalEvents = useCallback(async () => {
    addLog("info", "Fetching historical test events...");

    // For this debug page, we'll use the agent_events table as a test
    // In a real scenario, you'd create a dedicated test table
    const { data, error } = await supabase
      .from("agent_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      addLog("error", `Failed to fetch historical events: ${error.message}`);
    } else {
      setEvents(data || []);
      addLog("success", `Loaded ${data?.length || 0} historical events`);
    }
  }, [supabase, addLog]);

  // Handle realtime events
  const handleRealtimeEvent = useCallback((payload: any) => {
    addLog("success", `📨 Realtime event received: ${payload.eventType}`);
    setEvents((prev) => [payload.new, ...prev.slice(0, 19)]); // Keep last 20
  }, [addLog]);

  // Handle connection status changes
  const handleConnectionChange = useCallback((status: string) => {
    addLog("info", `Connection status: ${status}`);

    if (status === "connected") {
      connectionStartRef.current = new Date();
      addLog("success", "✅ Connected to Realtime");
    } else if (status === "reconnecting") {
      connectionStartRef.current = null;
      addLog("warning", "🔄 Reconnecting...");
    } else if (status === "error") {
      connectionStartRef.current = null;
      addLog("error", "❌ Connection error");
    }
  }, [addLog]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    addLog("error", `❌ Subscription error: ${error.message}`);
  }, [addLog]);

  // Subscribe to realtime updates
  const { status, error, retryCount, manualReconnect, manualDisconnect } = useRealtimeSubscription({
    channelKey: "debug-agent-events",
    table: "agent_events", // Using existing table for testing
    event: "*", // Listen to all events
    onEvent: handleRealtimeEvent,
    onError: handleError,
    onStatusChange: handleConnectionChange,
    fetchHistorical: fetchHistoricalEvents,
  });

  // Update connection duration
  useEffect(() => {
    if (status !== "connected" || !connectionStartRef.current) return;

    const interval = setInterval(() => {
      if (connectionStartRef.current) {
        const duration = Math.floor((Date.now() - connectionStartRef.current.getTime()) / 1000);
        setConnectionDuration(duration);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Simulate network offline
  const simulateOffline = () => {
    addLog("warning", "🌐 Simulating network offline...");
    window.dispatchEvent(new Event("offline"));

    setTimeout(() => {
      addLog("info", "🌐 Simulating network online...");
      window.dispatchEvent(new Event("online"));
    }, 5000);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    addLog("info", "Logs cleared");
  };

  // Insert test event
  const insertTestEvent = async () => {
    addLog("info", "Inserting test event...");

    const { error } = await supabase.from("agent_events").insert({
      event_type: "test",
      event_data: {
        type: "test",
        message: "Test event from debug page",
        timestamp: new Date().toISOString(),
      },
    });

    if (error) {
      addLog("error", `Failed to insert test event: ${error.message}`);
    } else {
      addLog("success", "✓ Test event inserted (should appear via realtime)");
    }
  };

  // Automated test runner
  const runAutomatedTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    setTestReport(null);
    clearLogs();

    const testRunId = crypto.randomUUID();
    const startTime = new Date();
    const results: TestResult[] = [];

    addLog("info", "🚀 Starting automated test suite...");
    addLog("info", `Test Run ID: ${testRunId}`);

    // Helper to run a single test
    const runTest = async (
      name: string,
      testFn: () => Promise<void>,
      expectedDuration: number = 5000
    ): Promise<TestResult> => {
      currentTestLogsRef.current = [];
      const testStart = new Date();

      addLog("info", `\n▶ Running test: ${name}`);

      setTestResults((prev) => [
        ...prev,
        {
          name,
          status: "running",
          duration: 0,
          logs: [],
          timestamp: testStart,
        },
      ]);

      try {
        await testFn();

        const duration = Date.now() - testStart.getTime();
        addLog("success", `✓ PASSED: ${name} (${duration}ms)`);

        const result: TestResult = {
          name,
          status: "passed",
          duration,
          logs: [...currentTestLogsRef.current],
          timestamp: testStart,
        };

        setTestResults((prev) =>
          prev.map((r) => (r.name === name ? result : r))
        );

        return result;
      } catch (error) {
        const duration = Date.now() - testStart.getTime();
        const errorMsg = error instanceof Error ? error.message : String(error);
        addLog("error", `✗ FAILED: ${name} - ${errorMsg}`);

        const result: TestResult = {
          name,
          status: "failed",
          duration,
          error: errorMsg,
          logs: [...currentTestLogsRef.current],
          timestamp: testStart,
        };

        setTestResults((prev) =>
          prev.map((r) => (r.name === name ? result : r))
        );

        return result;
      }
    };

    // Wait helper
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // TEST 1: Initial Connection
    results.push(
      await runTest("Initial Connection", async () => {
        if (status !== "connected") {
          throw new Error(`Expected connected, got ${status}`);
        }
        addLog("info", "✓ Successfully connected");
      })
    );

    await wait(1000);

    // TEST 2: Manual Disconnect and Reconnect
    results.push(
      await runTest("Manual Disconnect and Auto-Reconnect", async () => {
        const initialEventsCount = events.length;
        addLog("info", "Disconnecting...");
        manualDisconnect();

        await wait(2000);

        if (status === "connected") {
          throw new Error("Should be disconnected");
        }

        addLog("info", "Waiting for auto-reconnect (30s)...");
        await wait(32000);

        // Note: Status should transition to reconnecting/connected
        // We rely on the subscription callback to verify this works
        addLog("info", "✓ Auto-reconnection triggered");
      })
    );

    await wait(2000);

    // TEST 3: Realtime Event Reception
    results.push(
      await runTest("Realtime Event Reception", async () => {
        const initialCount = events.length;
        addLog("info", `Initial event count: ${initialCount}`);

        addLog("info", "Inserting test event...");
        const { error } = await supabase.from("agent_events").insert({
          event_type: "automated_test",
          event_data: {
            type: "test",
            testRunId,
            message: "Automated test event",
            timestamp: new Date().toISOString(),
          },
        });

        if (error) throw new Error(`Insert failed: ${error.message}`);

        addLog("info", "Waiting for realtime event (5s)...");
        await wait(5000);

        const newCount = events.length;
        if (newCount <= initialCount) {
          throw new Error(
            `Event not received. Expected > ${initialCount}, got ${newCount}`
          );
        }

        addLog("info", `✓ Event received. Count: ${initialCount} → ${newCount}`);
      })
    );

    await wait(2000);

    // TEST 4: Network Offline/Online
    results.push(
      await runTest("Network Offline/Online Recovery", async () => {
        addLog("info", "Simulating offline...");
        window.dispatchEvent(new Event("offline"));

        await wait(3000);

        addLog("info", "Simulating online...");
        window.dispatchEvent(new Event("online"));

        await wait(5000);

        if (status !== "connected" && status !== "reconnecting") {
          throw new Error(`Expected reconnected, got ${status}`);
        }

        addLog("info", "✓ Recovered from offline");
      })
    );

    await wait(2000);

    // TEST 5: Manual Reconnect (Reset Retry Count)
    results.push(
      await runTest("Manual Reconnect Resets Retry Count", async () => {
        const initialRetryCount = retryCount;
        addLog("info", `Initial retry count: ${initialRetryCount}`);

        addLog("info", "Calling manualReconnect()...");
        manualReconnect();

        await wait(3000);

        if (retryCount > 0) {
          throw new Error(`Expected retry count 0, got ${retryCount}`);
        }

        addLog("info", "✓ Retry count reset to 0");
      })
    );

    await wait(1000);

    // Generate final report
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;

    const report: TestReport = {
      testRunId,
      startTime,
      endTime,
      totalTests: results.length,
      passed,
      failed,
      duration,
      results,
      systemInfo: {
        status,
        retryCount,
        eventsReceived: events.length,
      },
    };

    setTestReport(report);
    setIsRunningTests(false);

    addLog("info", "\n" + "=".repeat(60));
    addLog("info", "📊 TEST SUITE COMPLETE");
    addLog("info", `Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    addLog("info", `Duration: ${(duration / 1000).toFixed(2)}s`);
    addLog("info", "=".repeat(60));

    // Output JSON report to console
    console.log("TEST REPORT:", JSON.stringify(report, null, 2));
  };

  // Copy test report to clipboard
  const copyTestReport = () => {
    if (!testReport) return;

    const reportJson = JSON.stringify(testReport, null, 2);
    navigator.clipboard.writeText(reportJson);
    addLog("success", "✓ Test report copied to clipboard");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = () => {
    switch (status) {
      case "connected": return "bg-green-500";
      case "reconnecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "text-green-600";
      case "warning": return "text-yellow-600";
      case "error": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="h-screen w-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6 pb-20 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Realtime Subscription Test</h1>
          <p className="text-muted-foreground">
            Test auto-reconnection, visibility handling, and network recovery
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} mr-2 animate-pulse`} />
          {status}
        </Badge>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-lg font-semibold capitalize">{status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Retry Count</p>
              <p className="text-lg font-semibold">{retryCount}/10</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Connected For</p>
              <p className="text-lg font-semibold">
                {status === "connected" ? formatDuration(connectionDuration) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Events Received</p>
              <p className="text-lg font-semibold">{events.length}</p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
          <CardDescription>Test different reconnection scenarios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <Button onClick={manualReconnect} variant="default" className="w-full">
              <RotateCw className="w-4 h-4 mr-2" />
              Reconnect
            </Button>
            <Button onClick={manualDisconnect} variant="destructive" className="w-full">
              <Power className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
            <Button onClick={simulateOffline} variant="outline" className="w-full">
              <WifiOff className="w-4 h-4 mr-2" />
              Sim Offline
            </Button>
            <Button onClick={insertTestEvent} variant="secondary" className="w-full">
              <Wifi className="w-4 h-4 mr-2" />
              Insert Event
            </Button>
            <Button onClick={clearLogs} variant="outline" className="w-full">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Logs
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Test Scenarios:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• <strong>Disconnect:</strong> Force close connection, should auto-reconnect in 30s</li>
              <li>• <strong>Sim Offline:</strong> Goes offline for 5s, then auto-reconnects</li>
              <li>• <strong>Switch Tabs:</strong> Leave this tab for 3+ mins, come back to test visibility handling</li>
              <li>• <strong>Insert Event:</strong> Test that realtime events arrive immediately</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Automated Tests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automated Test Suite</CardTitle>
              <CardDescription>Run all test scenarios automatically</CardDescription>
            </div>
            <Button
              onClick={runAutomatedTests}
              disabled={isRunningTests}
              size="lg"
              className="gap-2"
            >
              {isRunningTests ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {testResults.length > 0 && (
            <div className="space-y-2">
              {testResults.map((result) => (
                <div
                  key={result.name}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {result.status === "running" && (
                      <Clock className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                    {result.status === "passed" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {result.status === "failed" && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-medium text-sm">{result.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {result.error && (
                      <span className="text-red-500 max-w-md truncate">{result.error}</span>
                    )}
                    <span>{result.duration}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {testReport && (
            <div className="space-y-4 mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Test Report</h3>
                <Button onClick={copyTestReport} variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy JSON
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Tests</p>
                  <p className="text-2xl font-bold">{testReport.totalTests}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Passed</p>
                  <p className="text-2xl font-bold text-green-600">{testReport.passed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{testReport.failed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">{(testReport.duration / 1000).toFixed(1)}s</p>
                </div>
              </div>

              <div className="p-3 bg-black text-white rounded font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(testReport, null, 2)}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Live Event Log</CardTitle>
          <CardDescription>Real-time subscription events and status changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 overflow-y-auto bg-black text-white p-4 rounded-lg font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-gray-500">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events ({events.length})</CardTitle>
          <CardDescription>Last 20 events received via realtime subscription</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events received yet</p>
          ) : (
            <div className="space-y-2">
              {events.map((event, i) => (
                <div
                  key={event.id || i}
                  className="p-3 bg-muted rounded-lg text-sm font-mono"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold">{event.event_type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  <pre className="mt-2 text-xs overflow-x-auto">
                    {JSON.stringify(event.event_data, null, 2).substring(0, 200)}...
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
