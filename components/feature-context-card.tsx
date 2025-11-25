"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, Lightbulb } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Feature } from "@/lib/types/features";

interface FeatureContextCardProps {
  appIdea: string;
  features: Feature[];
  className?: string;
  defaultOpen?: boolean;
}

export function FeatureContextCard({
  appIdea,
  features,
  className,
  defaultOpen = false,
}: FeatureContextCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const includedFeatures = features.filter((f) => f.is_included);
  const excludedFeatures = features.filter((f) => !f.is_included);

  if (features.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-md overflow-hidden max-w-xl",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                APP PLAN
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {includedFeatures.length} features selected
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-gray-500 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-800 pt-2">
            {/* App Idea */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">App Idea:</p>
              <p className="text-sm">{appIdea}</p>
            </div>

            {/* Included Features */}
            {includedFeatures.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Check className="h-3 w-3 text-green-600" />
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    Included Features
                  </p>
                </div>
                <div className="space-y-1">
                  {includedFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="text-green-600 dark:text-green-400 mt-0.5">
                        +
                      </span>
                      <div className="flex-1">
                        <span className="font-medium">{feature.title}</span>
                        {feature.is_custom && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-[9px] px-1 py-0"
                          >
                            Custom
                          </Badge>
                        )}
                        {feature.description && (
                          <span className="text-muted-foreground">
                            {" "}
                            - {feature.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Excluded Features */}
            {excludedFeatures.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <X className="h-3 w-3 text-gray-400" />
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Not Included
                  </p>
                </div>
                <div className="space-y-1">
                  {excludedFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="mt-0.5">-</span>
                      <span>{feature.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
