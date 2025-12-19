"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, Palette, AlertCircle, Code, Copy, Check, Send, User, Bot, Zap } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { DesignCanvas } from "@/components/design-generator/design-canvas";
import type { ParsedScreen } from "@/components/design-generator/streaming-screen-preview";
import type { DesignGenerationResult } from "@/lib/ai/types";

type GenerationMode = "react" | "html";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DesignGenerationResult | null>(null);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Streaming mode state
  const [generationMode, setGenerationMode] = useState<GenerationMode>("react");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPrompt, setStreamingPrompt] = useState("");
  const [streamedScreens, setStreamedScreens] = useState<ParsedScreen[] | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim() || isLoading || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);

    setError("");

    // Handle based on generation mode
    if (generationMode === "html") {
      // HTML Streaming Mode
      setIsStreaming(true);
      setStreamingPrompt(userMessage);
      setStreamedScreens(null);

      // Add assistant message indicating streaming started
      const streamingMessage: ChatMessage = {
        role: "assistant",
        content: "Generating your HTML design in real-time...",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, streamingMessage]);
    } else {
      // React Mode (original behavior)
      setIsLoading(true);

      try {
        const isFollowUp = result !== null;

        const res = await fetch("/api/ai/generate-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userMessage,
            // Send current design for follow-ups
            currentDesign: isFollowUp ? result : undefined,
            // Send conversation history for context
            conversationHistory: messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const data: DesignResponse = await res.json();

        if (data.success && data.data) {
          setResult(data.data.design);

          // Add assistant message
          const screensUpdated = data.data.design.screens.length;
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: isFollowUp
              ? `Updated the design. ${screensUpdated} screens are now ready.`
              : `Created "${data.data.design.appName}" with ${screensUpdated} screens: ${data.data.design.screens.map(s => s.name).join(", ")}.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          setError(data.error?.message || "Failed to generate design");
          // Add error as assistant message
          const errorMessage: ChatMessage = {
            role: "assistant",
            content: `Sorry, I encountered an error: ${data.error?.message || "Failed to generate design"}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } catch (err) {
        console.error("Design generation error:", err);
        setError("Failed to generate design. Please try again.");
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle HTML streaming completion
  const handleStreamComplete = (screens: ParsedScreen[]) => {
    setIsStreaming(false);
    setStreamedScreens(screens);
    setStreamingPrompt("");

    // Update the last assistant message
    setMessages(prev => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
        const screenNames = screens.map(s => s.name).join(", ");
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: screens.length === 1
            ? `HTML design generated! The "${screens[0].name}" screen is now displayed on the canvas.`
            : `HTML design generated! ${screens.length} screens created: ${screenNames}.`,
        };
      }
      return newMessages;
    });
  };

  // Handle streaming error
  const handleStreamError = (errorMsg: string) => {
    setIsStreaming(false);
    setStreamingPrompt("");
    setError(errorMsg);

    // Update the last assistant message
    setMessages(prev => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: `Sorry, streaming failed: ${errorMsg}`,
        };
      }
      return newMessages;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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

  const handleNewChat = () => {
    setMessages([]);
    setResult(null);
    setError("");
    setSelectedScreenIndex(0);
    // Reset streaming state
    setIsStreaming(false);
    setStreamingPrompt("");
    setStreamedScreens(null);
  };

  const selectedScreen = result?.screens[selectedScreenIndex];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header - Matching marketing navbar style */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          <Link
            href="/home/admin/playground"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="size-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Palette className="size-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1A2B48]">
                Design Generator
              </h1>
              <p className="text-xs text-gray-500">
                Powered by Gemini 3 Pro
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Generation Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Mode:</span>
            <Select
              value={generationMode}
              onValueChange={(value: GenerationMode) => setGenerationMode(value)}
              disabled={isLoading || isStreaming}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm border-gray-200 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="react">
                  <div className="flex items-center gap-2">
                    <Code className="size-3.5 text-gray-500" />
                    <span>React</span>
                  </div>
                </SelectItem>
                <SelectItem value="html">
                  <div className="flex items-center gap-2">
                    <Zap className="size-3.5 text-blue-500" />
                    <span>HTML (Streaming)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme colors preview */}
          {result && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-100">
              <span className="text-sm font-medium text-gray-700">{result.appName}</span>
              <div className="flex gap-1.5">
                <div
                  className="size-5 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: result.theme.primary }}
                  title={`Primary: ${result.theme.primary}`}
                />
                <div
                  className="size-5 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: result.theme.secondary }}
                  title={`Secondary: ${result.theme.secondary}`}
                />
                <div
                  className="size-5 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: result.theme.accent }}
                  title={`Accent: ${result.theme.accent}`}
                />
              </div>
            </div>
          )}
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="text-sm border-gray-200 text-gray-600 hover:text-[#1A2B48] hover:border-[#1A2B48] rounded-full px-4"
              disabled={isStreaming}
            >
              New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Chat & Code */}
          <ResizablePanel defaultSize={28} minSize={22} maxSize={40}>
            <div className="h-full flex flex-col bg-white border-r border-gray-100 overflow-hidden">
              <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <TabsList className="mx-4 mt-4 bg-gray-100 p-1 rounded-full flex-shrink-0">
                  <TabsTrigger
                    value="chat"
                    className="flex-1 text-sm rounded-full data-[state=active]:bg-white data-[state=active]:text-[#1A2B48] data-[state=active]:shadow-sm text-gray-600"
                  >
                    Chat
                  </TabsTrigger>
                  <TabsTrigger
                    value="code"
                    className="flex-1 text-sm rounded-full data-[state=active]:bg-white data-[state=active]:text-[#1A2B48] data-[state=active]:shadow-sm text-gray-600 disabled:text-gray-400 disabled:opacity-50"
                    disabled={!result}
                  >
                    <Code className="size-3.5 mr-1.5" />
                    Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                          <Sparkles className="size-8 text-indigo-500" />
                        </div>
                        <h3 className="text-[#1A2B48] font-semibold text-lg mb-2">
                          Describe your app
                        </h3>
                        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                          Tell me what kind of app you want to design, and I&apos;ll create beautiful screens for you.
                        </p>
                        <div className="mt-8 space-y-2 w-full">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Examples</p>
                          {[
                            "A fitness tracking app with workout plans",
                            "A recipe app with meal planning",
                            "A meditation app with calming visuals",
                          ].map((example, i) => (
                            <button
                              key={i}
                              onClick={() => setInputValue(example)}
                              className="w-full text-left text-sm text-gray-600 hover:text-[#1A2B48] p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-all"
                            >
                              &ldquo;{example}&rdquo;
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {messages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            {message.role === "assistant" && (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <Bot className="size-4 text-indigo-600" />
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                                message.role === "user"
                                  ? "bg-[#1A2B48] text-white"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            {message.role === "user" && (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="size-4 text-gray-600" />
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                              <Bot className="size-4 text-indigo-600" />
                            </div>
                            <div className="bg-gray-100 rounded-2xl px-4 py-3">
                              <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Screen List (when result exists) */}
                  {result && (
                    <div className="flex-shrink-0 border-t border-gray-100 p-3 bg-gray-50/50">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                        Screens ({result.screens.length})
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {result.screens.map((screen, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedScreenIndex(index)}
                            className={`flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                              selectedScreenIndex === index
                                ? "bg-[#1A2B48] text-white shadow-sm"
                                : "bg-white text-gray-600 hover:text-[#1A2B48] border border-gray-200 hover:border-[#1A2B48]"
                            }`}
                          >
                            {screen.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input Area */}
                  <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
                    {/* Mode indicator */}
                    {generationMode === "html" && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full w-fit">
                        <Zap className="size-3" />
                        <span>HTML streaming: UI builds in real-time</span>
                      </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex gap-3">
                      <div className="flex-1 relative">
                        <textarea
                          ref={inputRef}
                          value={inputValue}
                          onChange={handleInputChange}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            generationMode === "html"
                              ? "Describe your app to generate..."
                              : result
                                ? "Ask for changes..."
                                : "Describe your app..."
                          }
                          rows={1}
                          className="w-full resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A2B48]/20 focus:border-[#1A2B48] transition-all"
                          disabled={isLoading || isStreaming}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading || isStreaming || !inputValue.trim()}
                        className="bg-[#1A2B48] hover:bg-[#1A2B48]/90 text-white rounded-xl px-4 shadow-sm disabled:opacity-50"
                      >
                        {isLoading || isStreaming ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                      </Button>
                    </form>
                    {error && !messages.length && (
                      <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                        <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600">{error}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="code" className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {selectedScreen && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">{selectedScreen.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-gray-600 hover:text-[#1A2B48] hover:bg-gray-100 rounded-lg"
                          onClick={() => handleCopyCode(selectedScreen.code)}
                        >
                          {copied ? (
                            <Check className="size-3.5 mr-1.5 text-green-500" />
                          ) : (
                            <Copy className="size-3.5 mr-1.5" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto bg-[#282c34]">
                        <SyntaxHighlighter
                          language="jsx"
                          style={oneDark}
                          customStyle={{
                            margin: 0,
                            background: "transparent",
                            fontSize: "12px",
                            lineHeight: "1.5",
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

          <ResizableHandle className="w-1 bg-gray-100 hover:bg-indigo-200 transition-colors" />

          {/* Right Panel - Canvas */}
          <ResizablePanel defaultSize={72}>
            {/* HTML Streaming mode canvas */}
            {generationMode === "html" && (isStreaming || streamedScreens) ? (
              <DesignCanvas
                screens={[]}
                theme={{
                  primary: "#6366f1",
                  secondary: "#818cf8",
                  background: "#ffffff",
                  foreground: "#1f2937",
                  accent: "#8b5cf6",
                  cssVariables: ":root { --primary: #6366f1; --secondary: #818cf8; --background: #ffffff; --foreground: #1f2937; --accent: #8b5cf6; }",
                }}
                isStreaming={isStreaming}
                streamingPrompt={streamingPrompt}
                streamingScreenName="Preview"
                streamedScreens={streamedScreens}
                onStreamComplete={handleStreamComplete}
                onStreamError={handleStreamError}
              />
            ) : result ? (
              <DesignCanvas screens={result.screens} theme={result.theme} />
            ) : isLoading ? (
              <div className="h-full flex items-center justify-center bg-gray-50 relative">
                {/* Dot Pattern Background */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)`,
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="text-center z-10">
                  {/* Animated Design Loader */}
                  <div className="relative mb-8">
                    {/* Outer ring */}
                    <div className="w-24 h-24 rounded-full border-4 border-gray-200 mx-auto" />
                    {/* Spinning gradient ring */}
                    <div className="absolute inset-0 w-24 h-24 mx-auto">
                      <svg className="w-24 h-24 animate-spin" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="50%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#6366f1" />
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
                      <Palette className="size-8 text-indigo-500 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-[#1A2B48] mb-2">
                    Generating your designs
                  </h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Creating beautiful screens for your app...
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    This can take up to a minute
                  </p>
                  {/* Animated dots */}
                  <div className="flex justify-center gap-1.5 mt-6">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 relative">
                {/* Dot Pattern Background */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)`,
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="text-center relative z-10">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Palette className="size-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    No designs yet
                  </h3>
                  <p className="text-sm text-gray-400 max-w-md">
                    Describe your app idea in the chat to get started
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
