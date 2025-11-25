"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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
        <p className="text-sm text-muted-foreground">
          {includedCount} of {features.length} features selected
        </p>
      </div>

      <div className="space-y-2">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-colors",
              feature.is_included
                ? "bg-primary/5 border-primary/20"
                : "bg-muted/30 border-border"
            )}
          >
            <Checkbox
              id={`feature-${feature.id}`}
              checked={feature.is_included}
              onCheckedChange={(checked) =>
                onToggle(feature.id, checked === true)
              }
              disabled={disabled}
              className="mt-0.5"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor={`feature-${feature.id}`}
                  className={cn(
                    "text-sm font-medium cursor-pointer",
                    !feature.is_included && "text-muted-foreground"
                  )}
                >
                  {feature.title}
                </label>

                {feature.is_recommended && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Recommended
                  </Badge>
                )}

                {feature.is_custom && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Custom
                  </Badge>
                )}
              </div>

              {feature.description && (
                <p
                  className={cn(
                    "text-xs mt-1",
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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(feature.id)}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
