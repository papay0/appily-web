"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface OperationalEventDetailsProps {
  details: Record<string, unknown>;
  status: string;
  operation: string;
}

export function OperationalEventDetails({
  details,
  status,
  operation,
}: OperationalEventDetailsProps) {
  // Auto-expand for failed operations, collapsed for others
  const [isOpen, setIsOpen] = useState(status === "failed");

  // Don't render if no details
  if (!details || Object.keys(details).length === 0) {
    return null;
  }

  // Format detail values for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="mt-1 ml-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            type="button"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
            <span>{isOpen ? "Hide" : "Show"} details</span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-1.5">
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="space-y-1">
              {Object.entries(details).map(([key, value]) => {
                const formattedValue = formatValue(value);
                if (!formattedValue) return null;

                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {key.replace(/_/g, " ")}:
                    </span>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap break-words bg-white dark:bg-gray-950 rounded px-2 py-1 border border-gray-200 dark:border-gray-800">
                      {formattedValue}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
