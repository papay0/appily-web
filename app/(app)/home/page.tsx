"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { AppIdeaInput } from "@/components/app-idea-input";
import { RecentProjectsSection } from "@/components/recent-projects-section";
import { ParticleField } from "@/components/marketing/ParticleField";
import Image from "next/image";
import { Sparkles } from "lucide-react";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour < 18) return { text: "Good afternoon", emoji: "🌤️" };
  return { text: "Good evening", emoji: "🌙" };
}

export default function HomePage() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const greeting = getGreeting();

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

  const handleCreateProject = async (
    appIdea: string,
    planFeatures: boolean,
    imageKeys: string[],
    tempUploadId: string
  ) => {
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

      // 3. Link temp images to project (if any)
      let linkedImageKeys: string[] = [];
      if (imageKeys.length > 0 && tempUploadId) {
        try {
          const linkResponse = await fetch("/api/images/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tempUploadId,
              projectId: project.id,
            }),
          });

          if (linkResponse.ok) {
            const linkData = await linkResponse.json();
            linkedImageKeys = linkData.newKeys || [];
            console.log(`Linked ${linkedImageKeys.length} images to project ${project.id}`);
          }
        } catch (linkError) {
          console.error("Failed to link images:", linkError);
          // Continue anyway - images are not critical
        }
      }

      // 4. Navigate to appropriate page (image keys are now stored in DB by /api/images/link)
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
    <div className="min-h-screen relative overflow-hidden">
      {/* ============================================
          AMBIENT BACKGROUND
          ============================================ */}
      <div className="fixed inset-0 -z-10">
        {/* Soft gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />

        {/* Subtle gradient orbs */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[var(--magic-violet)]/5 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />

        {/* Subtle particles */}
        <ParticleField particleCount={15} />

        {/* Noise texture */}
        <div className="absolute inset-0 noise-overlay" />
      </div>

      {/* ============================================
          MAIN CONTENT
          ============================================ */}
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-2xl mx-auto">
          {/* Greeting with time-based message */}
          <div className="animate-fade-in-up opacity-0 animation-delay-200">
            <span className="inline-flex items-center gap-2 text-lg text-muted-foreground mb-4">
              <span>{greeting.emoji}</span>
              <span>{greeting.text}</span>
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display text-foreground mb-6 animate-fade-in-up opacity-0 animation-delay-400">
            <span className="flex items-center justify-center gap-3 flex-wrap">
              What will you
              <span className="inline-flex items-center gap-2">
                <Image
                  src="/appily-logo.svg"
                  alt="Appily"
                  width={48}
                  height={48}
                  className="inline animate-float-gentle"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-gradient-magic">build</span>
              </span>
              today?
            </span>
          </h1>

          {/* Subtext with sparkle */}
          <p className="text-lg md:text-xl text-muted-foreground flex items-center justify-center gap-2 animate-fade-in-up opacity-0 animation-delay-600">
            <Sparkles className="h-5 w-5 text-primary animate-pulse-slow" />
            <span>Describe your app idea and let AI bring it to life</span>
            <Sparkles className="h-5 w-5 text-primary animate-pulse-slow animation-delay-1000" />
          </p>
        </div>

        {/* App Idea Input */}
        <div className="w-full max-w-2xl animate-scale-fade-in opacity-0 animation-delay-800">
          <AppIdeaInput onSubmit={handleCreateProject} isLoading={isCreating} />
        </div>

        {/* Recent Projects */}
        <div className="w-full animate-fade-in-up opacity-0 animation-delay-1000">
          <RecentProjectsSection projects={projects} maxDisplay={6} loading={loading} />
        </div>
      </div>
    </div>
  );
}
