"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { ProjectCreationForm } from "@/components/project-creation-form";
import { ProjectList } from "@/components/project-list";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function HomePage() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

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
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  // Show creation form if no projects or user clicked "New Project"
  if (projects.length === 0 && !showCreateForm) {
    return <ProjectCreationForm />;
  }

  if (showCreateForm) {
    return (
      <div>
        <button
          onClick={() => setShowCreateForm(false)}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to projects
        </button>
        <ProjectCreationForm />
      </div>
    );
  }

  return (
    <ProjectList
      projects={projects}
      onCreateNew={() => setShowCreateForm(true)}
    />
  );
}
