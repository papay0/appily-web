"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Sparkles } from "lucide-react";

interface AppIdeaInputProps {
  onSubmit: (idea: string, planFeatures: boolean) => void;
  isLoading: boolean;
}

export function AppIdeaInput({ onSubmit, isLoading }: AppIdeaInputProps) {
  const [idea, setIdea] = useState("");
  const [planFeatures, setPlanFeatures] = useState(true);

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
      {/* Large dark input container */}
      <div className="relative bg-card rounded-2xl shadow-lg border overflow-hidden">
        {/* Textarea for app idea */}
        <Textarea
          placeholder="Ask Appily to create a fitness tracker, expense manager, recipe book..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={4}
          className="min-h-[140px] bg-transparent border-none text-foreground placeholder:text-muted-foreground text-lg p-6 pb-20 resize-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between border-t">
          <div className="flex items-center gap-2">
            <Checkbox
              id="plan-features"
              checked={planFeatures}
              onCheckedChange={(checked) => setPlanFeatures(checked === true)}
              disabled={isLoading}
            />
            <Label
              htmlFor="plan-features"
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            >
              Plan features
            </Label>
          </div>

          {/* Dynamic button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
            className="rounded-full px-6 font-medium"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : planFeatures ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Create & Plan
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Create
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-center text-muted-foreground text-sm mt-3">
        Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">Enter</kbd> to submit
      </p>
    </div>
  );
}
