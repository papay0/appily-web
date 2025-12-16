"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { FeatureChecklist } from "@/components/feature-checklist";
import { AddFeatureDialog } from "@/components/add-feature-dialog";
import { ProjectHeader } from "@/components/project-header";
import { ClickableImageGrid } from "@/components/clickable-image-grid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight, Loader2, Lightbulb, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Feature, GeneratedFeature } from "@/lib/types/features";

interface Project {
  id: string;
  name: string;
  app_idea: string | null;
  planning_completed_at: string | null;
  image_keys: string[] | null;
}

// Local feature type for planning (before saving to DB)
interface PlanningFeature {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_included: boolean;
  is_recommended: boolean;
  is_custom: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function FeatureListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 bg-muted/50" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-4 p-4 rounded-2xl",
              "bg-card border border-border",
              "animate-fade-in-up opacity-0"
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <Skeleton className="h-5 w-5 rounded-md mt-0.5 bg-muted/50" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 bg-muted/50" />
              <Skeleton className="h-3 w-full bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanPageSkeleton() {
  return (
    <div className="flex flex-col h-full relative">
      {/* Gradient orbs background */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] opacity-30 dark:opacity-15 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-200/60 dark:bg-blue-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-orange-200/50 dark:bg-orange-500/15 rounded-full blur-[120px]" />
        </div>
      </div>

      <ProjectHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          <div className="space-y-3 animate-fade-in-up opacity-0">
            <Skeleton className="h-9 w-72 bg-muted/50" />
            <Skeleton className="h-5 w-96 bg-muted/30" />
          </div>
          <div className="rounded-2xl border border-border p-5 bg-card animate-fade-in-up opacity-0 animation-delay-200">
            <Skeleton className="h-4 w-24 mb-3 bg-muted/50" />
            <Skeleton className="h-16 w-full bg-muted/30" />
          </div>
          <FeatureListSkeleton />
        </div>
      </div>
      <div className="border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <Skeleton className="h-12 w-full rounded-full bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

export default function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [generatingFeatures, setGeneratingFeatures] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [features, setFeatures] = useState<PlanningFeature[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Load project
  useEffect(() => {
    async function loadProject() {
      if (!user) return;

      try {
        const { data: projectData, error } = await supabase
          .from("projects")
          .select("id, name, app_idea, planning_completed_at, image_keys")
          .eq("id", projectId)
          .single();

        if (error || !projectData) {
          console.error("Error loading project:", error);
          router.push("/home");
          return;
        }

        // If planning is already completed, redirect to build
        if (projectData.planning_completed_at) {
          router.push(`/home/projects/build/${projectId}`);
          return;
        }

        setProject(projectData);
        setLoading(false);

        // Fetch preview URLs for images if they exist
        if (projectData.image_keys && projectData.image_keys.length > 0) {
          try {
            const response = await fetch("/api/images/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageKeys: projectData.image_keys }),
            });
            if (response.ok) {
              const { previewUrls } = await response.json();
              setImagePreviewUrls(previewUrls);
            }
          } catch (error) {
            console.error("Error fetching image preview URLs:", error);
          }
        }

        // Start generating features if we have an app idea
        if (projectData.app_idea) {
          setGeneratingFeatures(true);
          // Use image_keys from database instead of URL params
          const imageKeys: string[] = projectData.image_keys || [];
          await generateFeatures(projectData.app_idea, imageKeys);
        }
      } catch (error) {
        console.error("Error:", error);
        router.push("/home");
      }
    }

    loadProject();
  }, [user, projectId, supabase, router]);

  const generateFeatures = async (appIdea: string, imageKeys: string[]) => {
    try {
      const response = await fetch("/api/features/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, appIdea, imageKeys }),
      });

      if (!response.ok) throw new Error("Failed to generate features");

      const { features: generatedFeatures } = await response.json();

      const mappedFeatures: PlanningFeature[] = generatedFeatures.map(
        (f: GeneratedFeature, index: number) => ({
          id: `generated-${index}`,
          project_id: projectId,
          title: f.title,
          description: f.description,
          is_included: f.is_recommended,
          is_recommended: f.is_recommended,
          is_custom: false,
          sort_order: index,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      );

      setFeatures(mappedFeatures);
    } catch (error) {
      console.error("Error generating features:", error);
    } finally {
      setGeneratingFeatures(false);
    }
  };

  const handleToggleFeature = (featureId: string, isIncluded: boolean) => {
    setFeatures((prev) =>
      prev.map((f) => (f.id === featureId ? { ...f, is_included: isIncluded } : f))
    );
  };

  const handleDeleteFeature = (featureId: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== featureId));
  };

  const handleAddFeature = (title: string, description: string) => {
    const newFeature: PlanningFeature = {
      id: `custom-${Date.now()}`,
      project_id: projectId,
      title,
      description: description || null,
      is_included: true,
      is_recommended: false,
      is_custom: true,
      sort_order: features.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setFeatures((prev) => [...prev, newFeature]);
    setAddDialogOpen(false);
  };

  const handleStartBuilding = async () => {
    if (!project) return;

    setIsSaving(true);
    try {
      // 1. Save features to database
      if (features.length > 0) {
        const featuresToInsert = features.map((f, index) => ({
          project_id: projectId,
          title: f.title,
          description: f.description,
          is_included: f.is_included,
          is_recommended: f.is_recommended,
          is_custom: f.is_custom,
          sort_order: index,
        }));

        const { error: featuresError } = await supabase
          .from("project_features")
          .insert(featuresToInsert);

        if (featuresError) {
          console.error("Error saving features:", featuresError);
          throw featuresError;
        }
      }

      // 2. Update project planning_completed_at
      const { error: projectError } = await supabase
        .from("projects")
        .update({ planning_completed_at: new Date().toISOString() })
        .eq("id", projectId);

      if (projectError) {
        console.error("Error updating project:", projectError);
        throw projectError;
      }

      // 3. Navigate to build page
      router.push(`/home/projects/build/${projectId}`);
    } catch (error) {
      console.error("Error starting build:", error);
      setIsSaving(false);
    }
  };

  if (loading) {
    return <PlanPageSkeleton />;
  }

  if (!project) {
    return null;
  }

  const includedCount = features.filter((f) => f.is_included).length;
  const totalCount = features.length;
  const progressPercent = totalCount > 0 ? (includedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full relative">
      {/* Gradient orbs background */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] opacity-30 dark:opacity-15 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-200/60 dark:bg-blue-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-orange-200/50 dark:bg-orange-500/15 rounded-full blur-[120px]" />
        </div>
      </div>

      <ProjectHeader projectId={project.id} projectName={project.name} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Header */}
          <div className="space-y-3 animate-fade-in-up opacity-0">
            <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground">
              Plan Your{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                  Features
                </span>
                <svg
                  className="absolute w-full h-2 -bottom-0.5 left-0 text-primary/30 dark:text-primary/40"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="6" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Select the features you want to build. Customize the list before starting.
            </p>
          </div>

          {/* App Idea Card */}
          {project.app_idea && (
            <div className="animate-fade-in-up opacity-0 animation-delay-200">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Your App Idea
                  </span>
                </div>
                <p className="text-foreground leading-relaxed">{project.app_idea}</p>
              </div>
            </div>
          )}

          {/* Reference Images Card */}
          {imagePreviewUrls.length > 0 && (
            <div className="animate-fade-in-up opacity-0 animation-delay-400">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Reference Images
                  </span>
                </div>
                <ClickableImageGrid imageUrls={imagePreviewUrls} thumbnailSize="lg" />
              </div>
            </div>
          )}

          {/* Features Section */}
          <div className="space-y-4 animate-fade-in-up opacity-0 animation-delay-600">
            {generatingFeatures ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="relative">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="absolute inset-0 h-5 w-5 animate-ping text-primary opacity-20">
                      <Loader2 className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    AI is analyzing your idea and generating features...
                  </span>
                </div>
                <FeatureListSkeleton />
              </div>
            ) : (
              <>
                <FeatureChecklist
                  features={features as Feature[]}
                  onToggle={handleToggleFeature}
                  onDelete={handleDeleteFeature}
                  disabled={isSaving}
                />

                {/* Add Feature Button */}
                <button
                  onClick={() => setAddDialogOpen(true)}
                  disabled={isSaving}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 border-dashed border-border",
                    "flex items-center justify-center gap-2",
                    "text-muted-foreground hover:text-foreground",
                    "hover:border-primary/50 hover:bg-primary/5",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Add Custom Feature</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            {/* Progress indicator */}
            {features.length > 0 && !generatingFeatures && (
              <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                <div className="relative h-10 w-10">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      className="stroke-muted"
                      strokeWidth="2"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      className="stroke-primary transition-all duration-500"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${progressPercent} 100`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                    {includedCount}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{includedCount} selected</p>
                  <p className="text-muted-foreground text-xs">of {totalCount} features</p>
                </div>
              </div>
            )}

            {/* Start Building Button */}
            <button
              onClick={handleStartBuilding}
              disabled={isSaving || generatingFeatures}
              className={cn(
                "flex-1 py-3.5 px-6 rounded-full font-semibold text-base",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-all duration-200",
                "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
                "hover:scale-[1.02] active:scale-[0.98]",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Start Building</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* Mobile feature count */}
          {features.length > 0 && !generatingFeatures && (
            <p className="sm:hidden text-center text-sm text-muted-foreground mt-3">
              {includedCount} of {totalCount} features selected
            </p>
          )}
        </div>
      </div>

      {/* Add Feature Dialog */}
      <AddFeatureDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddFeature}
      />
    </div>
  );
}
