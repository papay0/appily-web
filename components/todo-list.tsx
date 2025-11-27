"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, ChevronDown, ListTodo, Sparkles } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface Todo {
  content: string;
  activeForm: string;
  status: "pending" | "in_progress" | "completed";
}

interface TodoListProps {
  todos: Todo[];
  className?: string;
  isLatest?: boolean; // Whether this is the latest/active todo list
  isOpen?: boolean; // Controlled open state
  onOpenChange?: (open: boolean) => void; // Callback when open state changes
}

export function TodoList({
  todos,
  className,
  isLatest = false,
  isOpen: controlledIsOpen,
  onOpenChange
}: TodoListProps) {
  // Use controlled state if provided, otherwise default to isLatest
  const isOpen = controlledIsOpen ?? isLatest;

  if (!todos || todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const totalCount = todos.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllCompleted = completedCount === totalCount;

  return (
    <div
      className={cn(
        "glass-morphism rounded-xl overflow-hidden max-w-xl",
        "border border-border/50",
        "shadow-lg shadow-primary/5",
        "animate-fade-in-up",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-3 py-2.5 hover:bg-foreground/5 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "h-6 w-6 rounded-lg flex items-center justify-center",
                isAllCompleted
                  ? "bg-[var(--magic-mint)]/20"
                  : "bg-primary/10"
              )}>
                {isAllCompleted ? (
                  <Sparkles className="h-3.5 w-3.5 text-[var(--magic-mint)] animate-sparkle" />
                ) : (
                  <ListTodo className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <div className="text-xs font-semibold text-foreground/80">
                  {isAllCompleted ? "All tasks completed" : "Tasks"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {completedCount} of {totalCount} complete
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Progress bar */}
              <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    isAllCompleted
                      ? "bg-gradient-to-r from-[var(--magic-mint)] to-green-400"
                      : "bg-gradient-to-r from-primary to-[var(--magic-violet)]"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="animate-accordion-down">
          <div className="px-3 pb-3 space-y-1 border-t border-border/50 pt-2">
            {todos.map((todo, index) => {
              // For historical todo lists, treat in_progress as completed
              const displayStatus = !isLatest && todo.status === "in_progress" ? "completed" : todo.status;

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-2.5 py-1.5 px-2 rounded-lg transition-all duration-200",
                    displayStatus === "in_progress" && "bg-primary/5 border border-primary/10"
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {displayStatus === "completed" && (
                      <div className="relative">
                        <CheckCircle2 className="h-4 w-4 text-[var(--magic-mint)]" />
                      </div>
                    )}
                    {displayStatus === "in_progress" && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                        <Loader2 className="h-4 w-4 text-primary animate-spin relative" />
                      </div>
                    )}
                    {displayStatus === "pending" && (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        displayStatus === "completed" &&
                          "text-muted-foreground line-through decoration-muted-foreground/50",
                        displayStatus === "in_progress" &&
                          "text-foreground font-medium",
                        displayStatus === "pending" &&
                          "text-muted-foreground"
                      )}
                    >
                      {displayStatus === "in_progress"
                        ? todo.activeForm
                        : todo.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
