"use client";

import { useEffect, useState, useCallback } from "react";
import { Iphone } from "@/components/ui/iphone";
import { Sparkles, Check } from "lucide-react";

interface Message {
  id: number;
  type: "user" | "ai";
  text: string;
  features?: string[];
}

interface DemoScenario {
  userMessage: string;
  aiResponse: string;
  features: string[];
  appPreview: {
    title: string;
    color: string;
    icon: string;
  };
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    userMessage: "I want a habit tracker app",
    aiResponse: "I'll create a habit tracker with:",
    features: ["Daily streaks", "Reminders", "Progress charts"],
    appPreview: {
      title: "HabitFlow",
      color: "from-emerald-400 to-teal-500",
      icon: "check",
    },
  },
  {
    userMessage: "Build me a recipe organizer",
    aiResponse: "Creating your recipe app with:",
    features: ["Photo upload", "Ingredients list", "Step-by-step mode"],
    appPreview: {
      title: "RecipeBook",
      color: "from-orange-400 to-rose-500",
      icon: "book",
    },
  },
  {
    userMessage: "I need a fitness tracker",
    aiResponse: "Building your fitness app with:",
    features: ["Workout logs", "Goal setting", "Progress photos"],
    appPreview: {
      title: "FitPro",
      color: "from-blue-400 to-indigo-500",
      icon: "activity",
    },
  },
];

export function LiveChatDemo() {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [stage, setStage] = useState<
    "idle" | "user-typing" | "user-sent" | "ai-typing" | "ai-sent" | "features" | "preview"
  >("idle");
  const [displayedUserText, setDisplayedUserText] = useState("");
  const [showFeatures, setShowFeatures] = useState<number[]>([]);

  const scenario = DEMO_SCENARIOS[currentScenario];

  const resetDemo = useCallback(() => {
    setStage("idle");
    setDisplayedUserText("");
    setShowFeatures([]);
  }, []);

  const runDemo = useCallback(() => {
    const delays = {
      startTyping: 500,
      typingSpeed: 40,
      afterUserSent: 800,
      aiTypingDuration: 1500,
      featureDelay: 300,
      previewDelay: 500,
      holdPreview: 3000,
      nextScenario: 1000,
    };

    // Stage 1: User starts typing
    setTimeout(() => setStage("user-typing"), delays.startTyping);

    // Stage 2: Type out user message
    const userMessage = scenario.userMessage;
    let charIndex = 0;
    const typingInterval = setInterval(() => {
      if (charIndex <= userMessage.length) {
        setDisplayedUserText(userMessage.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typingInterval);
        setStage("user-sent");

        // Stage 3: AI starts typing
        setTimeout(() => setStage("ai-typing"), delays.afterUserSent);

        // Stage 4: AI response appears
        setTimeout(() => {
          setStage("ai-sent");

          // Stage 5: Features appear one by one
          scenario.features.forEach((_, index) => {
            setTimeout(() => {
              setShowFeatures((prev) => [...prev, index]);
            }, delays.featureDelay * (index + 1));
          });

          // Stage 6: Show app preview
          setTimeout(() => {
            setStage("preview");

            // Reset and move to next scenario
            setTimeout(() => {
              setCurrentScenario((prev) => (prev + 1) % DEMO_SCENARIOS.length);
              resetDemo();
            }, delays.holdPreview);
          }, delays.featureDelay * scenario.features.length + delays.previewDelay);
        }, delays.afterUserSent + delays.aiTypingDuration);
      }
    }, delays.typingSpeed);

    return () => clearInterval(typingInterval);
  }, [scenario, resetDemo]);

  useEffect(() => {
    const cleanup = runDemo();
    return cleanup;
  }, [currentScenario, runDemo]);

  return (
    <div className="relative">
      {/* Floating decorative elements */}
      <div className="absolute -top-8 -right-8 w-16 h-16 rounded-full bg-[var(--magic-violet)]/20 blur-xl animate-float-gentle" />
      <div className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full bg-primary/20 blur-xl animate-float-gentle animation-delay-2000" />
      <div className="absolute top-1/2 -right-12 w-8 h-8 rounded-full bg-[var(--magic-coral)]/30 blur-lg animate-pulse-slow" />

      {/* Sparkles around the phone */}
      <Sparkles className="absolute -top-4 left-1/4 w-5 h-5 text-[var(--magic-gold)] animate-sparkle animation-delay-500" />
      <Sparkles className="absolute top-1/3 -right-6 w-4 h-4 text-primary animate-sparkle animation-delay-1000" />
      <Sparkles className="absolute bottom-1/4 -left-6 w-4 h-4 text-[var(--magic-violet)] animate-sparkle animation-delay-1800" />

      {/* iPhone with custom content */}
      <div className="relative w-[280px] md:w-[320px]">
        <Iphone className="relative z-10" />

        {/* Custom content overlay inside phone screen */}
        <div
          className="absolute z-20 overflow-hidden bg-gradient-to-b from-background to-background/95"
          style={{
            left: "4.9%",
            top: "2.18%",
            width: "89.95%",
            height: "95.64%",
            borderRadius: "12.88% / 6.61%",
          }}
        >
          {/* App header */}
          <div className="bg-card/80 backdrop-blur-sm border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold">Appily AI</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online
                </div>
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 p-4 space-y-4 h-[calc(100%-60px)] overflow-hidden">
            {/* User message */}
            {(stage === "user-typing" || stage !== "idle") && (
              <div
                className={`flex justify-end ${stage === "user-typing" ? "animate-fade-in-up" : ""}`}
              >
                <div className="max-w-[85%] bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md text-sm">
                  {stage === "user-typing" ? (
                    <span>
                      {displayedUserText}
                      <span className="inline-block w-0.5 h-4 bg-primary-foreground/70 ml-0.5 animate-blink-cursor" />
                    </span>
                  ) : (
                    scenario.userMessage
                  )}
                </div>
              </div>
            )}

            {/* AI typing indicator */}
            {stage === "ai-typing" && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-typing-dot animate-typing-dot-1" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-typing-dot animate-typing-dot-2" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-typing-dot animate-typing-dot-3" />
                  </div>
                </div>
              </div>
            )}

            {/* AI response with features */}
            {(stage === "ai-sent" || stage === "features" || stage === "preview") && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="max-w-[90%] space-y-2">
                  <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-md text-sm">
                    {scenario.aiResponse}
                  </div>

                  {/* Feature chips */}
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {scenario.features.map((feature, index) => (
                      <div
                        key={feature}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                          showFeatures.includes(index)
                            ? "bg-primary/10 text-primary border border-primary/20 animate-bounce-in"
                            : "opacity-0 scale-0"
                        }`}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* App preview */}
            {stage === "preview" && (
              <div className="mt-4 animate-scale-fade-in">
                <div className="text-xs text-muted-foreground mb-2 text-center">
                  Building your app...
                </div>
                <div
                  className={`bg-gradient-to-br ${scenario.appPreview.color} rounded-xl p-4 shadow-lg`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">
                        {scenario.appPreview.title}
                      </div>
                      <div className="text-white/70 text-xs">Ready to preview</div>
                    </div>
                  </div>
                  <div className="h-24 bg-white/10 rounded-lg flex items-center justify-center">
                    <div className="flex gap-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-white/20 animate-pulse-subtle"
                          style={{ animationDelay: `${i * 200}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Idle state - welcome message */}
            {stage === "idle" && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-md text-sm">
                  What app would you like to build today?
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glow under phone */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-primary/20 blur-2xl rounded-full" />
    </div>
  );
}
