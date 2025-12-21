"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@/lib/supabase-client";
import { Smartphone, Clock, Plus, Sparkles, ArrowRight, Search, X, Trash2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";

interface Project {
  id: string;
  name: string;
  emoji?: string;
  created_at: string;
  updated_at: string;
}

// Refined Project Card
function ProjectCard({
  project,
  index,
  onDeleteClick,
}: {
  project: Project;
  index: number;
  onDeleteClick: (project: Project) => void;
}) {
  const router = useRouter();
  const [isHoveringDelete, setIsHoveringDelete] = useState(false);

  return (
    <div
      onClick={() => router.push(`/home/projects/build/${project.id}`)}
      className={cn(
        "group relative cursor-pointer",
        "p-6 rounded-2xl",
        "bg-card/50 hover:bg-card",
        "border border-border/50 hover:border-border",
        "transition-all duration-300 ease-out",
        "hover:shadow-lg hover:shadow-primary/5",
        "animate-fade-in-up opacity-0"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Subtle hover gradient */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Delete danger gradient - appears when hovering delete */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl bg-gradient-to-br from-destructive/[0.03] to-transparent transition-opacity duration-300 pointer-events-none",
          isHoveringDelete ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Content */}
      <div className="relative">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
          {project.emoji ? (
            <span className="text-2xl">{project.emoji}</span>
          ) : (
            <Smartphone className="w-6 h-6 text-primary" />
          )}
        </div>

        {/* Title */}
        <h3 className={cn(
          "text-lg font-semibold mb-2 transition-colors duration-300 line-clamp-1 pr-8",
          isHoveringDelete ? "text-destructive" : "group-hover:text-primary"
        )}>
          {project.name}
        </h3>

        {/* Timestamp */}
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
        </p>

        {/* Action button container - positioned at top right of content area */}
        <div className="absolute top-0 right-0">
          {/* Arrow - shows on card hover, hides when delete is hovered */}
          <div className={cn(
            "transition-all duration-200",
            isHoveringDelete ? "opacity-0 scale-75" : "opacity-0 group-hover:opacity-100"
          )}>
            <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </div>

        {/* Delete button - separate from arrow, top right corner of card */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(project);
          }}
          onMouseEnter={() => setIsHoveringDelete(true)}
          onMouseLeave={() => setIsHoveringDelete(false)}
          className={cn(
            "absolute -top-2 -right-2 p-2 rounded-xl",
            "bg-background/80 backdrop-blur-sm",
            "border border-border/50",
            "text-muted-foreground hover:text-destructive",
            "hover:bg-destructive/10 hover:border-destructive/30",
            "opacity-0 group-hover:opacity-100",
            "scale-90 group-hover:scale-100",
            "transition-all duration-200 ease-out",
            "z-20 shadow-sm hover:shadow-md"
          )}
          aria-label={`Delete ${project.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Search Bar - only shown when > 10 projects
function SearchBar({
  value,
  onChange,
  onClear
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative animate-fade-in-up">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search projects..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full pl-11 pr-10 py-3 rounded-xl",
          "bg-card/50 border border-border/50",
          "text-foreground placeholder:text-muted-foreground/60",
          "focus:outline-none focus:border-primary/50 focus:bg-card",
          "transition-all duration-300"
        )}
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// Elegant Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in-up">
      {/* Icon */}
      <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
        <Smartphone className="w-10 h-10 text-primary/60" />
        <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-primary/40" />
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Start by describing your app idea on the home page. Your creations will appear here.
      </p>

      {/* CTA */}
      <Link
        href="/home"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create your first app
      </Link>
    </div>
  );
}

// No Search Results State
function NoSearchResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No results found</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-4">
        No projects match &quot;{query}&quot;
      </p>
      <button
        onClick={onClear}
        className="text-primary hover:underline text-sm"
      >
        Clear search
      </button>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-32 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-5 w-48 rounded-lg bg-muted/30 animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-2xl border border-border/30 animate-fade-in-up opacity-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="w-12 h-12 rounded-xl bg-muted/50 animate-pulse mb-4" />
            <div className="h-5 w-32 rounded bg-muted/50 animate-pulse mb-2" />
            <div className="h-4 w-24 rounded bg-muted/30 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}/delete`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete project");
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      toast.success(`"${projectToDelete.name}" has been deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project"
      );
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  // Only show search bar if user has more than 10 projects
  const showSearchBar = projects.length > 10;

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

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
  }, [user, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen p-6 md:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  const clearSearch = () => setSearchQuery("");

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">
            Projects
          </h1>
          <p className="text-lg text-muted-foreground">
            {projects.length > 0
              ? `${projects.length} app${projects.length === 1 ? "" : "s"} in your collection`
              : "Your app collection"}
          </p>
        </div>

        {/* Search Bar - only shown when > 10 projects */}
        {showSearchBar && (
          <div className="mb-6">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={clearSearch}
            />
          </div>
        )}

        {/* Content */}
        {projects.length > 0 ? (
          filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  onDeleteClick={setProjectToDelete}
                />
              ))}
            </div>
          ) : (
            <NoSearchResults query={searchQuery} onClear={clearSearch} />
          )
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Delete Confirmation Dialog - Dramatic & Beautiful */}
      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && !isDeleting && setProjectToDelete(null)}
      >
        <AlertDialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-destructive/20">
          {/* Dramatic Header with Animated Warning */}
          <div className="relative bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent p-8 pb-6">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ef4444' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />

            {/* Animated warning icon */}
            <div className="relative flex justify-center mb-4">
              <div className="relative">
                {/* Pulsing rings */}
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-destructive/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-2 w-12 h-12 rounded-full bg-destructive/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />

                {/* Main icon container */}
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-lg shadow-destructive/25">
                  <Trash2 className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-center text-foreground">
              Delete Project
            </h2>
          </div>

          {/* Content */}
          <div className="p-6 pt-4">
            {/* Project name highlight */}
            <div className="bg-muted/50 rounded-xl p-4 mb-4 border border-border/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Project to delete</p>
              <p className="font-semibold text-foreground truncate text-lg">
                {projectToDelete?.name}
              </p>
            </div>

            {/* Warning message */}
            <div className="flex gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                This action is <span className="text-destructive font-medium">permanent</span> and cannot be undone.
                All code, designs, and data will be deleted forever.
              </p>
            </div>
          </div>

          {/* Actions - Stacked on mobile, side by side on larger */}
          <div className="p-6 pt-2 flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
              className={cn(
                "flex-1 px-4 py-3 rounded-xl font-medium",
                "bg-muted/50 hover:bg-muted",
                "border border-border/50 hover:border-border",
                "text-foreground",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                "flex-1 px-4 py-3 rounded-xl font-medium",
                "bg-destructive hover:bg-destructive/90",
                "text-white",
                "shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Forever
                </>
              )}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
