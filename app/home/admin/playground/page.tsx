"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface AIResponse {
  success: boolean;
  data?: {
    text?: string;
    analysis?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    remainingRequests?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface UsageResponse {
  success: boolean;
  data?: {
    requestCount: number;
    maxRequests: number;
    remainingRequests: number;
    periodEnd: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export default function AIPlayground() {
  // Project ID state
  const [projectId, setProjectId] = useState("");

  // Text generation state
  const [textPrompt, setTextPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [textResult, setTextResult] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState("");

  // Vision state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [visionPrompt, setVisionPrompt] = useState("What do you see in this image? Describe it in detail.");
  const [visionResult, setVisionResult] = useState("");
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Usage state
  const [usage, setUsage] = useState<UsageResponse["data"] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Check usage
  const checkUsage = async () => {
    if (!projectId) {
      alert("Please enter a Project ID first");
      return;
    }
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/ai/usage?projectId=${projectId}`);
      const data: UsageResponse = await res.json();
      if (data.success && data.data) {
        setUsage(data.data);
      } else {
        alert(data.error?.message || "Failed to fetch usage");
      }
    } catch {
      alert("Failed to fetch usage");
    } finally {
      setUsageLoading(false);
    }
  };

  // Text generation
  const generateText = async () => {
    if (!projectId) {
      setTextError("Please enter a Project ID first");
      return;
    }
    if (!textPrompt.trim()) {
      setTextError("Please enter a prompt");
      return;
    }

    setTextLoading(true);
    setTextError("");
    setTextResult("");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt: textPrompt,
          systemPrompt: systemPrompt || undefined,
        }),
      });

      const data: AIResponse = await res.json();

      if (data.success && data.data) {
        setTextResult(data.data.text || "");
        if (data.data.remainingRequests !== undefined) {
          setUsage((prev) =>
            prev
              ? { ...prev, remainingRequests: data.data!.remainingRequests! }
              : null
          );
        }
      } else {
        setTextError(data.error?.message || "Failed to generate text");
      }
    } catch {
      setTextError("Failed to generate text");
    } finally {
      setTextLoading(false);
    }
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64Data = base64.split(",")[1];
      setImageBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  // Vision analysis
  const analyzeImage = async () => {
    if (!projectId) {
      setVisionError("Please enter a Project ID first");
      return;
    }
    if (!imageBase64) {
      setVisionError("Please upload an image first");
      return;
    }
    if (!visionPrompt.trim()) {
      setVisionError("Please enter a prompt");
      return;
    }

    setVisionLoading(true);
    setVisionError("");
    setVisionResult("");

    try {
      const res = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          imageBase64,
          prompt: visionPrompt,
        }),
      });

      const data: AIResponse = await res.json();

      if (data.success && data.data) {
        setVisionResult(data.data.analysis || "");
        if (data.data.remainingRequests !== undefined) {
          setUsage((prev) =>
            prev
              ? { ...prev, remainingRequests: data.data!.remainingRequests! }
              : null
          );
        }
      } else {
        setVisionError(data.error?.message || "Failed to analyze image");
      }
    } catch {
      setVisionError("Failed to analyze image");
    } finally {
      setVisionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          AI Playground
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Test the AI text generation and vision APIs
        </p>

        {/* Project ID Input */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Configuration
          </h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project ID (UUID)
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={checkUsage}
              disabled={usageLoading || !projectId}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {usageLoading ? "Loading..." : "Check Usage"}
            </button>
          </div>

          {usage && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {usage.remainingRequests}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {" "}
                    / {usage.maxRequests} requests remaining
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Resets: {new Date(usage.periodEnd).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Text Generation Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Text Generation (GPT-4o)
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                System Prompt (optional)
              </label>
              <input
                type="text"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="e.g., You are a helpful assistant that speaks like a pirate."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prompt
              </label>
              <textarea
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <button
              onClick={generateText}
              disabled={textLoading || !projectId || !textPrompt.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {textLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Text"
              )}
            </button>

            {textError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {textError}
              </div>
            )}

            {textResult && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Result:
                </h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {textResult}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Vision Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Vision Analysis (GPT-4o)
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload Image
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 cursor-pointer hover:border-blue-500 transition-colors"
              >
                {imagePreview ? (
                  <div className="relative w-full h-64">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Click to upload an image
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prompt
              </label>
              <textarea
                value={visionPrompt}
                onChange={(e) => setVisionPrompt(e.target.value)}
                placeholder="What would you like to know about this image?"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <button
              onClick={analyzeImage}
              disabled={visionLoading || !projectId || !imageBase64}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {visionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze Image"
              )}
            </button>

            {visionError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {visionError}
              </div>
            )}

            {visionResult && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Analysis:
                </h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {visionResult}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
