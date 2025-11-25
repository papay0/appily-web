"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useSession } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureChecklist } from "@/components/feature-checklist";
import { AddFeatureDialog } from "@/components/add-feature-dialog";
import { Sparkles, Plus, ArrowRight, Loader2 } from "lucide-react";
import type { Feature, GeneratedFeature } from "@/lib/types/features";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  user_id: string;
  app_idea: string | null;
  planning_completed_at: string | null;
}

export default function PlanningPage() {
  const { isLoaded } = useSession();
  const supabase = useSupabaseClient();
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const projectId = params.projectId as string;

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Planning state
  const [appIdea, setAppIdea] = useState("");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStartingBuild, setIsStartingBuild] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAddingFeature, setIsAddingFeature] = useState(false);

  // Load project and existing features
  useEffect(() => {
    if (!user || !isLoaded) return;

    async function loadProject() {
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", user!.id)
          .single();

        if (!userData) {
          router.push("/home");
          return;
        }

        // Load project
        const { data: projectData, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("user_id", userData.id)
          .single();

        if (error || !projectData) {
          router.push("/home");
          return;
        }

        setProject(projectData);

        // If planning already completed, redirect to build page
        if (projectData.planning_completed_at) {
          router.push(`/home/projects/${projectId}`);
          return;
        }

        // Load existing app idea
        if (projectData.app_idea) {
          setAppIdea(projectData.app_idea);
        }

        // Load existing features
        const { data: featuresData } = await supabase
          .from("project_features")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });

        if (featuresData) {
          setFeatures(featuresData);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading project:", error);
        router.push("/home");
      }
    }

    loadProject();
  }, [user, projectId, router, isLoaded, supabase]);

  // Generate features from AI
  const handleGenerateFeatures = async () => {
    if (!appIdea.trim() || appIdea.trim().length < 10) return;

    setIsGenerating(true);

    try {
      // Call AI to generate features
      const response = await fetch("/api/features/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, appIdea: appIdea.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate features");
      }

      const { features: generatedFeatures } = await response.json();

      // Delete existing AI-generated features (keep custom ones)
      await supabase
        .from("project_features")
        .delete()
        .eq("project_id", projectId)
        .eq("is_custom", false);

      // Insert new features
      const featuresToInsert = generatedFeatures.map(
        (f: GeneratedFeature, index: number) => ({
          project_id: projectId,
          title: f.title,
          description: f.description,
          is_included: f.is_recommended, // Auto-select recommended features
          is_recommended: f.is_recommended,
          is_custom: false,
          sort_order: index,
        })
      );

      const { data: insertedFeatures } = await supabase
        .from("project_features")
        .insert(featuresToInsert)
        .select();

      // Update app_idea in projects table
      await supabase
        .from("projects")
        .update({ app_idea: appIdea.trim() })
        .eq("id", projectId);

      // Merge with existing custom features
      const customFeatures = features.filter((f) => f.is_custom);
      setFeatures([...(insertedFeatures || []), ...customFeatures]);
    } catch (error) {
      console.error("Error generating features:", error);
      alert("Failed to generate features. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle feature inclusion
  const handleToggleFeature = useCallback(
    async (id: string, included: boolean) => {
      // Optimistic update
      setFeatures((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_included: included } : f))
      );

      // Sync to database
      const { error } = await supabase
        .from("project_features")
        .update({ is_included: included, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        // Revert on error
        setFeatures((prev) =>
          prev.map((f) => (f.id === id ? { ...f, is_included: !included } : f))
        );
        console.error("Error updating feature:", error);
      }
    },
    [supabase]
  );

  // Delete custom feature
  const handleDeleteFeature = useCallback(
    async (id: string) => {
      const featureToDelete = features.find((f) => f.id === id);
      if (!featureToDelete?.is_custom) return;

      // Optimistic update
      setFeatures((prev) => prev.filter((f) => f.id !== id));

      // Sync to database
      const { error } = await supabase
        .from("project_features")
        .delete()
        .eq("id", id);

      if (error) {
        // Revert on error
        setFeatures((prev) => [...prev, featureToDelete]);
        console.error("Error deleting feature:", error);
      }
    },
    [supabase, features]
  );

  // Add custom feature
  const handleAddFeature = async (title: string, description: string) => {
    setIsAddingFeature(true);

    try {
      const { data: newFeature, error } = await supabase
        .from("project_features")
        .insert({
          project_id: projectId,
          title,
          description: description || null,
          is_included: true,
          is_recommended: false,
          is_custom: true,
          sort_order: features.length,
        })
        .select()
        .single();

      if (error) throw error;

      setFeatures((prev) => [...prev, newFeature]);
      setShowAddDialog(false);
    } catch (error) {
      console.error("Error adding feature:", error);
      alert("Failed to add feature. Please try again.");
    } finally {
      setIsAddingFeature(false);
    }
  };

  // Start building
  const handleStartBuilding = async () => {
    setIsStartingBuild(true);

    try {
      // Mark planning as completed
      await supabase
        .from("projects")
        .update({
          planning_completed_at: new Date().toISOString(),
          app_idea: appIdea.trim() || null,
        })
        .eq("id", projectId);

      // Navigate to build page
      router.push(`/home/projects/${projectId}`);
    } catch (error) {
      console.error("Error starting build:", error);
      alert("Failed to start building. Please try again.");
      setIsStartingBuild(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-4 w-96 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const hasFeatures = features.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <p className="text-muted-foreground">Plan your app features</p>
          </div>
          <Link href={`/home/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              Skip to Build
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* App Idea Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Describe Your App</CardTitle>
                <CardDescription>
                  Tell us what you want to build and we&apos;ll suggest features
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., A grocery list app that helps me track what I need to buy, organize items by store section, and share lists with my family..."
              value={appIdea}
              onChange={(e) => setAppIdea(e.target.value)}
              disabled={isGenerating}
              rows={4}
              className="resize-none"
            />
            <Button
              onClick={handleGenerateFeatures}
              disabled={
                isGenerating || appIdea.trim().length < 10
              }
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Features...
                </>
              ) : hasFeatures ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Regenerate Features
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Features
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Features Card */}
        {hasFeatures && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Features</CardTitle>
                  <CardDescription>
                    Select which features to include in your app
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Feature
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FeatureChecklist
                features={features}
                onToggle={handleToggleFeature}
                onDelete={handleDeleteFeature}
                disabled={isGenerating || isStartingBuild}
              />
            </CardContent>
          </Card>
        )}

        {/* Start Building Button */}
        {hasFeatures && (
          <Button
            size="lg"
            className="w-full"
            onClick={handleStartBuilding}
            disabled={isStartingBuild || isGenerating}
          >
            {isStartingBuild ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Building
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}

        {/* Add Feature Dialog */}
        <AddFeatureDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onAdd={handleAddFeature}
          isAdding={isAddingFeature}
        />
      </div>
    </div>
  );
}
