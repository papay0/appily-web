"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot } from "lucide-react";

export function ChatPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 pt-6">
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Chat with AI</p>
            <p className="text-xs text-muted-foreground mt-1">
              Coming soon - Describe your app and I'll help build it
            </p>
          </div>
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Describe your app..."
            disabled
            className="flex-1"
          />
          <Button disabled size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
