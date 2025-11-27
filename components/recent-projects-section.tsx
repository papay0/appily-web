"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Smartphone, Clock, Sparkles, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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

// 3D Project Card Component
function ProjectCard3D({ project, index }: { project: Project; index: number }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 25;
    const rotateY = (centerX - x) / 25;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(5px)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "perspective(1000px) rotateX(0) rotateY(0) translateZ(0)";
  };

  return (
    <div
      ref={cardRef}
      onClick={() => router.push(`/home/projects/build/${project.id}`)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative p-4 rounded-xl cursor-pointer",
        "glass-morphism",
        "transition-all duration-300 ease-out",
        "hover:shadow-xl hover:shadow-primary/10",
        "animate-fade-in-up opacity-0"
      )}
      style={{
        animationDelay: `${index * 100}ms`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 gradient-border pointer-events-none" />

      {/* Glow effect on hover */}
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/10 via-[var(--magic-violet)]/10 to-primary/10 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-300 pointer-events-none" />

      {/* Card content */}
      <div className="relative flex items-start gap-3" style={{ transform: "translateZ(20px)" }}>
        {/* App icon */}
        <div className="relative h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
          <Smartphone className="h-5 w-5 text-primary" />
          {/* Icon glow */}
          <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors duration-300">
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

// Enhanced Skeleton
function ProjectSkeleton({ index }: { index: number }) {
  return (
    <div
      className="relative p-4 rounded-xl glass-morphism animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 animate-pulse" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-24 rounded bg-muted/50 animate-shimmer" />
          <div className="h-3 w-16 rounded bg-muted/30 animate-shimmer animation-delay-200" />
        </div>
      </div>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="relative text-center py-12 px-6 rounded-2xl glass-morphism animate-fade-in-up">
      {/* Floating sparkles */}
      <Sparkles className="absolute top-4 left-1/4 w-4 h-4 text-[var(--magic-gold)] animate-sparkle" />
      <Sparkles className="absolute top-8 right-1/4 w-3 h-3 text-primary animate-sparkle animation-delay-700" />
      <Sparkles className="absolute bottom-8 left-1/3 w-3 h-3 text-[var(--magic-violet)] animate-sparkle animation-delay-1400" />

      {/* Icon */}
      <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
        <Smartphone className="h-8 w-8 text-primary animate-float-gentle" />
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse-slow" />
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold font-display mb-2">No projects yet</h3>
      <p className="text-muted-foreground max-w-xs mx-auto">
        Your first app is just a conversation away. Describe your idea above and watch the magic happen!
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

  // Loading state with enhanced skeletons
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-12">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-32 rounded bg-muted/50 animate-shimmer" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <ProjectSkeleton key={i} index={i} />
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
        <h2 className="text-lg font-semibold font-display flex items-center gap-2">
          <span className="text-gradient-magic">Your creations</span>
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
      <div className="md:hidden rounded-xl glass-morphism overflow-hidden">
        <Table>
          <TableBody>
            {displayProjects.map((project, index) => (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-primary/5 transition-colors animate-fade-in-up opacity-0"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => router.push(`/home/projects/build/${project.id}`)}
              >
                <TableCell className="py-3 px-3 w-10">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                </TableCell>
                <TableCell className="py-3 px-0 font-medium">
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

      {/* Desktop: 3D Grid view */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 perspective-container">
        {displayProjects.map((project, index) => (
          <ProjectCard3D key={project.id} project={project} index={index} />
        ))}
      </div>
    </div>
  );
}
