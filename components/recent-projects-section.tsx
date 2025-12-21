"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Smartphone, Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  emoji?: string;
  created_at: string;
  updated_at: string;
}

interface RecentProjectsSectionProps {
  projects: Project[];
  maxDisplay?: number;
  loading?: boolean;
}

// Clean Project Card Component
function ProjectCard({ project, index }: { project: Project; index: number }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/home/projects/build/${project.id}`)}
      className={cn(
        "group relative p-5 rounded-2xl cursor-pointer",
        "bg-card border border-border",
        "shadow-sm hover:shadow-xl",
        "transition-all duration-300",
        "hover:-translate-y-1",
        "animate-fade-in-up opacity-0"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Card content */}
      <div className="flex items-start gap-3">
        {/* App icon */}
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
          {project.emoji ? (
            <span className="text-xl">{project.emoji}</span>
          ) : (
            <Smartphone className="h-5 w-5" />
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-300">
            {project.name}
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(project.updated_at), {
              addSuffix: true,
            })}
          </p>
        </div>

        {/* Arrow indicator */}
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
      </div>
    </div>
  );
}

// Clean Skeleton
function ProjectSkeleton({ index }: { index: number }) {
  return (
    <div
      className="relative p-5 rounded-2xl bg-card border border-border shadow-sm animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function MobileProjectSkeletonRow({ index }: { index: number }) {
  return (
    <TableRow
      className="animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <TableCell className="py-3 px-3 w-10">
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
      </TableCell>
      <TableCell className="py-3 px-0">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </TableCell>
      <TableCell className="py-3 px-3 text-right">
        <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
      </TableCell>
    </TableRow>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="relative text-center py-12 px-6 rounded-3xl bg-card border border-border shadow-sm animate-fade-in-up">
      {/* Icon */}
      <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Smartphone className="h-8 w-8 text-primary" />
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold font-display text-foreground mb-2">No projects yet</h3>
      <p className="text-muted-foreground max-w-xs mx-auto">
        Your first app is just a conversation away. Describe your idea above!
      </p>
    </div>
  );
}

export function RecentProjectsSection({
  projects,
  maxDisplay = 6,
  loading = false,
}: RecentProjectsSectionProps) {
  const router = useRouter();
  const displayProjects = projects.slice(0, maxDisplay);

  // Loading state with clean skeletons
  if (loading) {
    const skeletonItems = Array.from({ length: maxDisplay });
    return (
      <div className="w-full max-w-4xl mx-auto mt-12">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-16 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="md:hidden rounded-xl bg-card border border-border shadow-sm overflow-hidden">
          <Table>
            <TableBody>
              {skeletonItems.map((_, index) => (
                <MobileProjectSkeletonRow key={index} index={index} />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {skeletonItems.map((_, index) => (
            <ProjectSkeleton key={index} index={index} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-12">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
          Your creations
          <span className="text-muted-foreground font-normal text-sm">({projects.length})</span>
        </h2>
        {projects.length > maxDisplay && (
          <Link
            href="/home/projects"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
          >
            View all
            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      {/* Mobile: Table view */}
      <div className="md:hidden rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        <Table>
          <TableBody>
            {displayProjects.map((project, index) => (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors animate-fade-in-up opacity-0"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => router.push(`/home/projects/build/${project.id}`)}
              >
                <TableCell className="py-3 px-3 w-10">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {project.emoji ? (
                      <span className="text-lg">{project.emoji}</span>
                    ) : (
                      <Smartphone className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 px-0 font-medium text-foreground">
                  <span className="truncate block max-w-[150px]">{project.name}</span>
                </TableCell>
                <TableCell className="py-3 px-3 text-right text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(project.updated_at), {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Desktop: Grid view */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {displayProjects.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </div>
  );
}
