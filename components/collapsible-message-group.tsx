"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolUse?: string;
  toolContext?: string;
  avatarUrl?: string;
}

interface CollapsibleMessageGroupProps {
  messages: Message[];
  title?: string;
  defaultOpen?: boolean;
}

export function CollapsibleMessageGroup({
  messages,
  title = "Setup Steps",
  defaultOpen = false,
}: CollapsibleMessageGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (messages.length === 0) return null;

  // Determine if all steps are completed
  const allCompleted = messages.every(
    (m) =>
      m.content.startsWith("✓") ||
      m.content.includes("completed") ||
      m.content.includes("ready")
  );
  const hasErrors = messages.some(
    (m) => m.content.startsWith("✗") || m.content.startsWith("Error")
  );

  return (
    <div className="w-full px-4 my-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            "rounded-lg border-2 overflow-hidden transition-all duration-200",
            allCompleted &&
              !hasErrors &&
              "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
            hasErrors &&
              "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
            !allCompleted &&
              !hasErrors &&
              "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
          )}
        >
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3 hover:bg-white/50 dark:hover:bg-black/20 transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    allCompleted &&
                      !hasErrors &&
                      "bg-green-500 dark:bg-green-600",
                    hasErrors && "bg-red-500 dark:bg-red-600",
                    !allCompleted &&
                      !hasErrors &&
                      "bg-blue-500 dark:bg-blue-600"
                  )}
                >
                  {allCompleted && !hasErrors ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : hasErrors ? (
                    <span className="text-white text-lg">!</span>
                  ) : (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">
                    {title}{" "}
                    {allCompleted && !hasErrors && (
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {messages.length} step{messages.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-1.5 border-t border-current/10">
              {messages.map((message) => {
                // Determine badge styling based on message content
                let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
                let badgeClassName = "";

                if (message.content.startsWith("✓")) {
                  badgeClassName =
                    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800";
                } else if (
                  message.content.startsWith("✗") ||
                  message.content.startsWith("Error")
                ) {
                  badgeVariant = "destructive";
                } else if (message.toolUse) {
                  // Tool-specific colors
                  if (message.toolUse === "Bash") {
                    badgeClassName =
                      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
                  } else if (message.toolUse === "Read") {
                    badgeClassName =
                      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
                  } else if (message.toolUse === "Write") {
                    badgeClassName =
                      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
                  } else if (message.toolUse === "Edit") {
                    badgeClassName =
                      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
                  }
                }

                return (
                  <div key={message.id} className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={badgeVariant}
                      className={cn(
                        "text-xs py-1 flex-1 justify-start",
                        badgeClassName
                      )}
                    >
                      {message.content}
                      {message.toolContext && (
                        <span className="ml-1 opacity-70">
                          • {message.toolContext}
                        </span>
                      )}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
