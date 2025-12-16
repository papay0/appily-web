"use client";

import { cn } from "@/lib/utils";
import { Trash2, Check, Star } from "lucide-react";
import type { Feature } from "@/lib/types/features";

interface FeatureChecklistProps {
  features: Feature[];
  onToggle: (id: string, included: boolean) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FeatureChecklist({
  features,
  onToggle,
  onDelete,
  disabled = false,
  className,
}: FeatureChecklistProps) {
  if (features.length === 0) {
    return null;
  }

  const includedCount = features.filter((f) => f.is_included).length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">
          {includedCount} of {features.length} features selected
        </p>
      </div>

      <div className="space-y-3">
        {features.map((feature, index) => (
          <div
            key={feature.id}
            onClick={() => !disabled && onToggle(feature.id, !feature.is_included)}
            className={cn(
              "group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200",
              "animate-fade-in-up opacity-0",
              "cursor-pointer select-none",
              feature.is_included
                ? "bg-card border-primary/30 shadow-sm"
                : "bg-card/50 border-border hover:border-primary/20 hover:bg-card",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Custom checkbox */}
            <div
              className={cn(
                "mt-0.5 h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0",
                "border-2 transition-all duration-200",
                feature.is_included
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border group-hover:border-primary/50 bg-background"
              )}
            >
              {feature.is_included && <Check className="h-3 w-3" strokeWidth={3} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-sm font-semibold transition-colors",
                    feature.is_included ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {feature.title}
                </span>

                {feature.is_recommended && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    Recommended
                  </span>
                )}

                {feature.is_custom && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                    Custom
                  </span>
                )}
              </div>

              {feature.description && (
                <p
                  className={cn(
                    "text-sm mt-1.5 leading-relaxed transition-colors",
                    feature.is_included
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {feature.description}
                </p>
              )}
            </div>

            {feature.is_custom && (
              <button
                type="button"
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  "text-muted-foreground/60 hover:text-destructive",
                  "hover:bg-destructive/10 transition-all duration-200",
                  "opacity-0 group-hover:opacity-100",
                  disabled && "hidden"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(feature.id);
                }}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
