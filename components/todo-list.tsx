"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

export interface Todo {
  content: string;
  activeForm: string;
  status: "pending" | "in_progress" | "completed";
}

interface TodoListProps {
  todos: Todo[];
  className?: string;
  isLatest?: boolean; // Whether this is the latest/active todo list
}

export function TodoList({ todos, className, isLatest = false }: TodoListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!todos || todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const totalCount = todos.length;
  // Only show in_progress status for the latest todo list
  const inProgressTodo = isLatest ? todos.find((t) => t.status === "in_progress") : undefined;

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
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                TASKS
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {completedCount}/{totalCount}
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
          <div className="px-3 pb-2 space-y-0.5 border-t border-gray-200 dark:border-gray-800 pt-1.5">
            {todos.map((todo, index) => {
              // For historical todo lists, treat in_progress as completed
              const displayStatus = !isLatest && todo.status === "in_progress" ? "completed" : todo.status;

              return (
                <div
                  key={index}
                  className="flex items-start gap-2 py-1"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {displayStatus === "completed" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    )}
                    {displayStatus === "in_progress" && (
                      <Loader2 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 animate-spin" />
                    )}
                    {displayStatus === "pending" && (
                      <Circle className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        displayStatus === "completed" &&
                          "text-gray-500 dark:text-gray-500 line-through",
                        displayStatus === "in_progress" &&
                          "text-gray-900 dark:text-gray-100",
                        displayStatus === "pending" &&
                          "text-gray-700 dark:text-gray-400"
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
