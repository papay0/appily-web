"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { AppIdeaInput } from "@/components/app-idea-input";
import { RecentProjectsSection } from "@/components/recent-projects-section";
import Image from "next/image";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}


export default function HomePage() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      if (!user) return;

      try {
        // Get user ID from Supabase
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!userData) return;

        // Fetch user's projects
        const { data: projectsData } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", userData.id)
          .order("updated_at", { ascending: false });

        setProjects(projectsData || []);
      } catch (error) {
        console.error("Error loading projects:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [user, supabase]);

  const handleCreateProject = async (appIdea: string, planFeatures: boolean) => {
    if (!user) return;
    setIsCreating(true);

    try {
      // 1. Get Supabase user ID
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", user.id)
        .single();

      if (!userData) throw new Error("User not found");

      // 2. Create minimal project (name will be generated later on build page)
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: "New Project", // Placeholder - will be generated async on build page
          user_id: userData.id,
          app_idea: appIdea,
          // planning_completed_at is NOT set if planFeatures is true
          ...(planFeatures ? {} : { planning_completed_at: new Date().toISOString() }),
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Navigate to appropriate page
      if (planFeatures) {
        // Go to plan page to generate and review features
        router.push(`/home/projects/plan/${project.id}`);
      } else {
        // Skip planning, go directly to build
        router.push(`/home/projects/build/${project.id}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Content */}
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 flex items-center justify-center gap-3 flex-wrap">
            Build something
            <span className="inline-flex items-center gap-2">
              <Image
                src="/appily-logo.svg"
                alt="Appily"
                width={44}
                height={44}
                className="inline"
                onError={(e) => {
                  // Hide if logo doesn't exist
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="text-primary">
                Appily
              </span>
            </span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Create mobile apps by chatting with AI
          </p>
        </div>

        {/* App Idea Input */}
        <AppIdeaInput onSubmit={handleCreateProject} isLoading={isCreating} />

        {/* Recent Projects */}
        <RecentProjectsSection projects={projects} maxDisplay={6} loading={loading} />
      </div>
    </div>
  );
}
