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
} from "lucide-react";
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

interface ToolUseGroupProps {
  messages: Message[];
  toolType: string;
}

export function ToolUseGroup({ messages, toolType }: ToolUseGroupProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (messages.length === 0) return null;

  // Determine icon and color based on tool type
  let Icon = Wrench;
  let badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";

  if (toolType === "Bash") {
    Icon = Terminal;
    badgeClass = "bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-100 border-gray-700 dark:border-gray-600";
  } else if (toolType === "Read") {
    Icon = FileText;
    badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800";
  } else if (toolType === "Write") {
    Icon = FilePlus;
    badgeClass = "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800";
  } else if (toolType === "Edit") {
    Icon = FileEdit;
    badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800";
  } else if (toolType === "Glob") {
    Icon = FolderSearch;
    badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800";
  }

  // Get the label based on tool type
  const getLabel = () => {
    const count = messages.length;
    if (toolType === "Edit") return `Edited files (${count})`;
    if (toolType === "Read") return `Read files (${count})`;
    if (toolType === "Write") return `Created files (${count})`;
    if (toolType === "Bash") return `Commands (${count})`;
    if (toolType === "Glob") return `File searches (${count})`;
    return `${toolType} (${count})`;
  };

  return (
    <div className="flex items-start gap-2 my-1.5 w-full animate-in fade-in duration-300 pl-9">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="max-w-xl">
        <CollapsibleTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1.5 inline-flex items-center border shadow-sm px-2.5 py-1 rounded-md text-xs cursor-pointer hover:opacity-80 transition-opacity",
              badgeClass
            )}
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">{getLabel()}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 flex-shrink-0 transition-transform duration-200 ml-1",
                isOpen && "rotate-180"
              )}
            />
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-1.5">
          <div className="space-y-1 ml-1 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
            {messages.map((message, index) => (
              <div key={message.id} className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 flex-shrink-0"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                  {message.toolContext || message.content.replace(`Using ${toolType}...`, '').trim()}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
