"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { FeatureChecklist } from "@/components/feature-checklist";
import { AddFeatureDialog } from "@/components/add-feature-dialog";
import { ProjectHeader } from "@/components/project-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight, Loader2, Sparkles } from "lucide-react";
import type { Feature, GeneratedFeature } from "@/lib/types/features";

interface Project {
  id: string;
  name: string;
  app_idea: string | null;
  planning_completed_at: string | null;
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
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
          >
            <Skeleton className="h-4 w-4 rounded mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanPageSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <ProjectHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="rounded-lg border p-4 bg-muted/30">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-16 w-full" />
          </div>
          <FeatureListSkeleton />
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

  // Load project
  useEffect(() => {
    async function loadProject() {
      if (!user) return;

      try {
        const { data: projectData, error } = await supabase
          .from("projects")
          .select("id, name, app_idea, planning_completed_at")
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

        // Start generating features if we have an app idea
        if (projectData.app_idea) {
          setGeneratingFeatures(true);
          await generateFeatures(projectData.app_idea);
        }
      } catch (error) {
        console.error("Error:", error);
        router.push("/home");
      }
    }

    loadProject();
  }, [user, projectId, supabase, router]);

  const generateFeatures = async (appIdea: string) => {
    try {
      const response = await fetch("/api/features/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, appIdea }),
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

  return (
    <div className="flex flex-col h-full">
      <ProjectHeader projectId={project.id} projectName={project.name} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Plan Your App Features
            </h1>
            <p className="text-muted-foreground">
              Select the features you want to build. You can customize this list
              before starting.
            </p>
          </div>

          {/* App Idea Display */}
          {project.app_idea && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Your App Idea
              </p>
              <p className="text-foreground">{project.app_idea}</p>
            </div>
          )}

          {/* Features Section */}
          <div className="space-y-4">
            {generatingFeatures ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating feature suggestions...
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
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(true)}
                  disabled={isSaving}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Feature
                </Button>
              </>
            )}
          </div>

          {/* Start Building Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleStartBuilding}
              disabled={isSaving || generatingFeatures}
              size="lg"
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Start Building
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            {features.length > 0 && !generatingFeatures && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                {includedCount} feature{includedCount !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
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
