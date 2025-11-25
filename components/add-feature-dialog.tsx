"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Feature</DialogTitle>
          <DialogDescription>
            Add your own feature idea to the list.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feature-title">Feature Name</Label>
            <Input
              id="feature-title"
              placeholder="e.g., Push notifications"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isAdding}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-description">
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
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isAdding}>
              {isAdding ? "Adding..." : "Add Feature"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
