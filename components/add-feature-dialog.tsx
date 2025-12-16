"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddFeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (title: string, description: string) => void;
  isAdding?: boolean;
}

export function AddFeatureDialog({
  open,
  onOpenChange,
  onAdd,
  isAdding = false,
}: AddFeatureDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd(title.trim(), description.trim());
    setTitle("");
    setDescription("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle("");
      setDescription("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Add Custom Feature</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Add your own feature idea to the list
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feature-title" className="text-sm font-medium">
                Feature Name
              </Label>
              <Input
                id="feature-title"
                placeholder="e.g., Push notifications"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isAdding}
                autoFocus
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feature-description" className="text-sm font-medium">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="feature-description"
                placeholder="What should this feature do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isAdding}
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 bg-muted/30 border-t border-border">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isAdding}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm",
                "bg-secondary text-secondary-foreground",
                "hover:bg-secondary/80 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isAdding}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-all",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Add Feature</span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
