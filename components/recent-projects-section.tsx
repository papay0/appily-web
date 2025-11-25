"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface RecentProjectsSectionProps {
  projects: Project[];
  maxDisplay?: number;
  loading?: boolean;
}

export function RecentProjectsSection({
  projects,
  maxDisplay = 6,
  loading = false,
}: RecentProjectsSectionProps) {
  const router = useRouter();
  const displayProjects = projects.slice(0, maxDisplay);

  // Show skeleton while loading
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-12">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="cursor-default">
              <CardHeader className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 mt-2" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-foreground">Recent Projects</h2>
        {projects.length > maxDisplay && (
          <Link
            href="/home/projects"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all ({projects.length})
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {displayProjects.map((project) => (
          <Card
            key={project.id}
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            onClick={() => router.push(`/home/projects/build/${project.id}`)}
          >
            <CardHeader className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-medium truncate">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(project.updated_at), {
                      addSuffix: true,
                    })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
