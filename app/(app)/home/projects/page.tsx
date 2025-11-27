"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@/lib/supabase-client";
import { Smartphone, Clock, Plus, Sparkles, ArrowRight, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Refined Project Card
function ProjectCard({ project, index }: { project: Project; index: number }) {
  const router = useRouter();

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
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content */}
      <div className="relative">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-300 line-clamp-1">
          {project.name}
        </h3>

        {/* Timestamp */}
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
        </p>

        {/* Arrow on hover */}
        <ArrowRight className="absolute top-6 right-0 w-5 h-5 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
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
                <ProjectCard key={project.id} project={project} index={index} />
              ))}
            </div>
          ) : (
            <NoSearchResults query={searchQuery} onClear={clearSearch} />
          )
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
