"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

interface QrCodeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode?: string;
  expoUrl?: string;
}

export function QrCodeSheet({
  open,
  onOpenChange,
  qrCode,
  expoUrl,
}: QrCodeSheetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!expoUrl) return;
    await navigator.clipboard.writeText(expoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] px-6">
        <SheetHeader className="text-center pb-2">
          <SheetTitle>Preview Your App</SheetTitle>
          <SheetDescription>
            Scan with Expo Go or open directly on this device
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col items-center gap-6 py-4 pb-8">
          {/* QR Code */}
          {qrCode && (
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <img
                src={qrCode}
                alt="QR Code for Expo Go"
                className="w-48 h-48"
              />
            </div>
          )}

          {/* Open in Expo Go button */}
          {expoUrl && (
            <Button asChild size="lg" className="w-full max-w-xs gap-2">
              <a href={expoUrl}>
                <ExternalLink className="h-4 w-4" />
                Open in Expo Go
              </a>
            </Button>
          )}

          {/* Expo URL with copy */}
          {expoUrl && (
            <div className="w-full max-w-xs">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <code className="text-xs flex-1 truncate">{expoUrl}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
