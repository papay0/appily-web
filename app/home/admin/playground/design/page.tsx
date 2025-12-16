"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, Palette, AlertCircle, Code, Copy, Check } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { DesignCanvas } from "@/components/design-generator/design-canvas";
import type { DesignGenerationResult } from "@/lib/ai/types";

interface DesignResponse {
  success: boolean;
  data?: {
    design: DesignGenerationResult;
  };
  error?: {
    code: string;
    message: string;
  };
}

export default function DesignPlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DesignGenerationResult | null>(null);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter an app description");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setSelectedScreenIndex(0);

    try {
      const res = await fetch("/api/ai/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data: DesignResponse = await res.json();

      if (data.success && data.data) {
        setResult(data.data.design);
      } else {
        setError(data.error?.message || "Failed to generate design");
      }
    } catch (err) {
      console.error("Design generation error:", err);
      setError("Failed to generate design. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const selectedScreen = result?.screens[selectedScreenIndex];

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0d0d0d]">
        <div className="flex items-center gap-4">
          <Link
            href="/home/admin/playground"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="size-5 text-gray-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <Palette className="size-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Design Generator
              </h1>
              <p className="text-xs text-gray-500">
                Powered by Gemini 3 Pro
              </p>
            </div>
          </div>
        </div>

        {/* Theme colors preview */}
        {result && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">{result.appName}</span>
            <div
              className="size-5 rounded-full border border-gray-600"
              style={{ backgroundColor: result.theme.primary }}
              title={`Primary: ${result.theme.primary}`}
            />
            <div
              className="size-5 rounded-full border border-gray-600"
              style={{ backgroundColor: result.theme.secondary }}
              title={`Secondary: ${result.theme.secondary}`}
            />
            <div
              className="size-5 rounded-full border border-gray-600"
              style={{ backgroundColor: result.theme.accent }}
              title={`Accent: ${result.theme.accent}`}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Input & Code */}
          <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
            <div className="h-full flex flex-col bg-[#0d0d0d] border-r border-gray-800 overflow-hidden">
              <Tabs defaultValue="prompt" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <TabsList className="mx-4 mt-4 bg-gray-800">
                  <TabsTrigger value="prompt" className="flex-1 text-xs">
                    Prompt
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex-1 text-xs" disabled={!result}>
                    <Code className="size-3 mr-1" />
                    Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="prompt" className="flex-1 flex flex-col p-4 gap-4">
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Describe Your App
                    </label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., A couples quiz app where partners can test how well they know each other..."
                      className="flex-1 resize-none bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 min-h-[150px]"
                      disabled={isLoading}
                    />
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>

                  {/* Error Display */}
                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                      <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Screen List */}
                  {result && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                        Screens ({result.screens.length})
                      </p>
                      {result.screens.map((screen, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedScreenIndex(index)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedScreenIndex === index
                              ? "bg-purple-900/30 border border-purple-500"
                              : "bg-gray-900 border border-gray-800 hover:border-gray-700"
                          }`}
                        >
                          <p className={`text-sm font-medium ${
                            selectedScreenIndex === index ? "text-purple-300" : "text-gray-300"
                          }`}>
                            {screen.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {screen.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="code" className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {selectedScreen && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
                        <span className="text-sm text-gray-400">{selectedScreen.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-gray-400 hover:text-white"
                          onClick={() => handleCopyCode(selectedScreen.code)}
                        >
                          {copied ? (
                            <Check className="size-3 mr-1 text-green-400" />
                          ) : (
                            <Copy className="size-3 mr-1" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <SyntaxHighlighter
                          language="jsx"
                          style={oneDark}
                          customStyle={{
                            margin: 0,
                            background: "transparent",
                            fontSize: "11px",
                            lineHeight: "1.4",
                            padding: "16px",
                          }}
                          showLineNumbers
                        >
                          {selectedScreen.code}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-gray-800 hover:bg-purple-600 transition-colors" />

          {/* Right Panel - Canvas */}
          <ResizablePanel defaultSize={75}>
            {result ? (
              <DesignCanvas screens={result.screens} theme={result.theme} />
            ) : isLoading ? (
              <div className="h-full flex items-center justify-center bg-[#1a1a1a] relative">
                {/* Dot Pattern Background */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="text-center z-10">
                  {/* Animated Design Loader */}
                  <div className="relative mb-8">
                    {/* Outer ring */}
                    <div className="w-24 h-24 rounded-full border-4 border-gray-700 mx-auto" />
                    {/* Spinning gradient ring */}
                    <div className="absolute inset-0 w-24 h-24 mx-auto">
                      <svg className="w-24 h-24 animate-spin" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#9333ea" />
                            <stop offset="50%" stopColor="#ec4899" />
                            <stop offset="100%" stopColor="#9333ea" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke="url(#gradient)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="70 200"
                        />
                      </svg>
                    </div>
                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Palette className="size-8 text-purple-400 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Generating your designs
                  </h3>
                  <p className="text-sm text-gray-400 max-w-sm">
                    Creating beautiful screens for your app...
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    This can take up to a minute
                  </p>
                  {/* Animated dots */}
                  <div className="flex justify-center gap-1 mt-4">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
                <div className="text-center">
                  <Palette className="size-16 text-gray-700 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-500">
                    No designs yet
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 max-w-md">
                    Enter an app description and click Generate
                  </p>
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
