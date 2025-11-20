"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { ProjectList } from "@/components/project-list";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      if (!user) return;

      try {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user.id)
          .single();

        if (!userData) return;

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
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Projects</h1>
        <p className="text-muted-foreground mt-2">
          All your app projects in one place
        </p>
      </div>

      {projects.length > 0 ? (
        <ProjectList projects={projects} />
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No projects yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first project from the Home page
          </p>
        </div>
      )}
    </div>
  );
}
