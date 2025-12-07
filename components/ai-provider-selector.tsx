"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/lib/agent/flows";

// Provider icons as simple SVG components
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
    >
      <path d="M17.303 6.818c-1.76-2.29-4.59-3.675-7.564-3.675C5.084 3.143 1.5 6.716 1.5 11.357c0 4.64 3.584 8.214 8.24 8.214 2.973 0 5.804-1.385 7.563-3.675l-2.02-1.565c-1.269 1.65-3.2 2.598-5.544 2.598-3.336 0-5.6-2.518-5.6-5.572s2.264-5.571 5.6-5.571c2.344 0 4.275.948 5.543 2.597l2.02-1.565z" />
      <path d="M22.5 11.357c0 1.387-.384 2.694-1.05 3.816l-1.854-1.438a5.11 5.11 0 0 0 .264-1.635c0-2.853-2.264-5.17-5.264-5.17v-2.643c4.32 0 7.904 3.573 7.904 7.07z" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}

interface AIProviderSelectorProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  disabled?: boolean;
  className?: string;
}

const providers: { id: AIProvider; name: string; icon: React.ReactNode }[] = [
  {
    id: "claude",
    name: "Claude",
    icon: <ClaudeIcon className="text-[#cc785c]" />,
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: <GeminiIcon className="text-[#4285f4]" />,
  },
];

export function AIProviderSelector({
  value,
  onChange,
  disabled = false,
  className,
}: AIProviderSelectorProps) {
  const selectedProvider = providers.find((p) => p.id === value) || providers[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
          "text-xs font-medium",
          "bg-background/50 backdrop-blur-sm",
          "border border-border/50",
          "hover:border-primary/50 hover:bg-muted/50",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          className
        )}
      >
        {selectedProvider.icon}
        <span className="text-muted-foreground">{selectedProvider.name}</span>
        <ChevronDown className="size-3 text-muted-foreground/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {providers.map((provider) => (
          <DropdownMenuItem
            key={provider.id}
            onClick={() => onChange(provider.id)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              value === provider.id && "bg-accent"
            )}
          >
            {provider.icon}
            <span>{provider.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { AIProvider };
