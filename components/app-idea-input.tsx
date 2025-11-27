"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Sparkles, Command } from "lucide-react";
import { MagicButton } from "@/components/marketing/MagicButton";
import { cn } from "@/lib/utils";

interface AppIdeaInputProps {
  onSubmit: (idea: string, planFeatures: boolean) => void;
  isLoading: boolean;
}

export function AppIdeaInput({ onSubmit, isLoading }: AppIdeaInputProps) {
  const [idea, setIdea] = useState("");
  const [planFeatures, setPlanFeatures] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    if (idea.trim().length < 10) return;
    onSubmit(idea.trim(), planFeatures);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = idea.trim().length >= 10 && !isLoading;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Glassmorphic input container */}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-2xl overflow-hidden transition-all duration-500",
          // Glassmorphism base
          "glass-morphism",
          // Focus states
          isFocused && "shadow-xl shadow-primary/10"
        )}
      >
        {/* Gradient border overlay */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500",
            isFocused ? "opacity-100" : "opacity-0",
            "gradient-border"
          )}
        />

        {/* Focus glow effect */}
        <div
          className={cn(
            "absolute -inset-1 rounded-2xl blur-xl transition-opacity duration-500 pointer-events-none",
            "bg-gradient-to-r from-primary/20 via-[var(--magic-violet)]/20 to-primary/20",
            isFocused ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Inner content */}
        <div className="relative">
          {/* Textarea for app idea */}
          <Textarea
            placeholder="Describe your app idea... A habit tracker with daily streaks, a recipe book with photo upload, a fitness log with progress charts..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isLoading}
            rows={5}
            className={cn(
              "min-h-[180px] bg-transparent border-none text-foreground",
              "placeholder:text-muted-foreground/60 text-lg p-6 pb-24",
              "resize-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "transition-colors duration-300"
            )}
          />

          {/* Bottom toolbar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between border-t border-border/50 bg-card/30 backdrop-blur-sm">
            {/* Left side - Checkbox */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Checkbox
                  id="plan-features"
                  checked={planFeatures}
                  onCheckedChange={(checked) => setPlanFeatures(checked === true)}
                  disabled={isLoading}
                  className={cn(
                    "transition-all duration-300",
                    planFeatures && "border-primary data-[state=checked]:bg-primary"
                  )}
                />
                {/* Sparkle on checked */}
                {planFeatures && (
                  <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-[var(--magic-gold)] animate-sparkle" />
                )}
              </div>
              <Label
                htmlFor="plan-features"
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Plan features first
              </Label>
            </div>

            {/* Right side - Submit button */}
            <MagicButton
              onClick={handleSubmit}
              className={cn(
                "px-6",
                !canSubmit && "opacity-50 pointer-events-none"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : planFeatures ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create & Plan
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Create
                </>
              )}
            </MagicButton>
          </div>
        </div>

        {/* Decorative sparkles */}
        <Sparkles
          className={cn(
            "absolute top-4 right-4 w-4 h-4 text-[var(--magic-violet)] transition-opacity duration-500",
            isFocused ? "opacity-100 animate-sparkle" : "opacity-0"
          )}
        />
        <Sparkles
          className={cn(
            "absolute top-8 right-8 w-3 h-3 text-primary transition-opacity duration-500 animation-delay-500",
            isFocused ? "opacity-100 animate-sparkle" : "opacity-0"
          )}
        />
      </div>

      {/* Helper text - hidden on mobile */}
      <p className="hidden md:flex items-center justify-center gap-2 text-muted-foreground text-sm mt-4">
        <span>Press</span>
        <kbd className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border/50 text-xs font-medium">
          <Command className="h-3 w-3" />
          <span>+</span>
          <span>Enter</span>
        </kbd>
        <span>to submit</span>
      </p>
    </div>
  );
}
