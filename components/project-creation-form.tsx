"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseClient } from "@/lib/supabase-client";
import { useUser } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

export function ProjectCreationForm() {
  const supabase = useSupabaseClient();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !user) return;

    setIsCreating(true);

    try {
      // Get user ID from Supabase users table using Clerk ID
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", user.id)
        .single();

      if (userError || !userData) {
        throw new Error("User not found");
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: name.trim(),
          user_id: userData.id,
        })
        .select()
        .single();

      if (projectError || !project) {
        throw new Error("Failed to create project");
      }

      // Navigate to project page
      router.push(`/home/projects/${project.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Create your first mobile app</CardTitle>
          <CardDescription>
            Give your app a name and start building with AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">App Name</Label>
              <Input
                id="name"
                placeholder="My Awesome App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
