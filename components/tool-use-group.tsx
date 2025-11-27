"use client";

import { cn } from "@/lib/utils";
import {
  FileText,
  FilePlus,
  FileEdit,
  Terminal,
  FolderSearch,
  Wrench,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
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

interface ToolUseGroupProps {
  messages: Message[];
  toolType: string;
}

export function ToolUseGroup({ messages, toolType }: ToolUseGroupProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (messages.length === 0) return null;

  // Determine icon and styling based on tool type
  let Icon = Wrench;
  let iconColorClass = "text-primary";
  let glowColorClass = "shadow-primary/10";
  let borderColorClass = "border-primary/20";
  let dotColorClass = "bg-primary/60";

  if (toolType === "Bash") {
    Icon = Terminal;
    iconColorClass = "text-gray-600 dark:text-gray-300";
    glowColorClass = "shadow-gray-500/10";
    borderColorClass = "border-gray-500/20";
    dotColorClass = "bg-gray-500/60";
  } else if (toolType === "Read") {
    Icon = FileText;
    iconColorClass = "text-blue-500";
    glowColorClass = "shadow-blue-500/10";
    borderColorClass = "border-blue-500/20";
    dotColorClass = "bg-blue-500/60";
  } else if (toolType === "Write") {
    Icon = FilePlus;
    iconColorClass = "text-[var(--magic-violet)]";
    glowColorClass = "shadow-[var(--magic-violet)]/10";
    borderColorClass = "border-[var(--magic-violet)]/20";
    dotColorClass = "bg-[var(--magic-violet)]/60";
  } else if (toolType === "Edit") {
    Icon = FileEdit;
    iconColorClass = "text-amber-500";
    glowColorClass = "shadow-amber-500/10";
    borderColorClass = "border-amber-500/20";
    dotColorClass = "bg-amber-500/60";
  } else if (toolType === "Glob") {
    Icon = FolderSearch;
    iconColorClass = "text-indigo-500";
    glowColorClass = "shadow-indigo-500/10";
    borderColorClass = "border-indigo-500/20";
    dotColorClass = "bg-indigo-500/60";
  }

  // Get the label based on tool type
  const getLabel = () => {
    const count = messages.length;
    if (toolType === "Edit") return `Edited ${count} file${count > 1 ? 's' : ''}`;
    if (toolType === "Read") return `Read ${count} file${count > 1 ? 's' : ''}`;
    if (toolType === "Write") return `Created ${count} file${count > 1 ? 's' : ''}`;
    if (toolType === "Bash") return `Ran ${count} command${count > 1 ? 's' : ''}`;
    if (toolType === "Glob") return `Searched ${count} pattern${count > 1 ? 's' : ''}`;
    return `${toolType} (${count})`;
  };

  return (
    <div className="flex items-start gap-2 my-1.5 w-full animate-fade-in-up pl-9">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="max-w-xl">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl",
              "glass-morphism",
              "text-xs cursor-pointer",
              "hover:scale-[1.02] active:scale-[0.98]",
              "transition-all duration-200",
              `shadow-lg ${glowColorClass}`,
              `border ${borderColorClass}`
            )}
          >
            <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", iconColorClass)} />
            <span className="font-medium text-foreground/80">{getLabel()}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 flex-shrink-0 transition-transform duration-200 ml-0.5 text-muted-foreground",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 animate-accordion-down">
          <div
            className={cn(
              "space-y-1.5 p-3 rounded-xl",
              "glass-morphism",
              `border ${borderColorClass}`,
              `shadow-md ${glowColorClass}`
            )}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className="flex items-start gap-2 group"
              >
                <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0 mt-1.5", dotColorClass)} />
                <span className="text-xs text-muted-foreground font-mono break-all leading-relaxed group-hover:text-foreground/70 transition-colors">
                  {message.toolContext || message.content.replace(`Using ${toolType}...`, '').trim()}
                </span>
              </div>
            ))}
            {/* Completion indicator */}
            <div className="flex items-center gap-1.5 pt-1.5 mt-1.5 border-t border-border/50">
              <CheckCircle2 className="h-3 w-3 text-[var(--magic-mint)]" />
              <span className="text-xs text-[var(--magic-mint)] font-medium">Completed</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
