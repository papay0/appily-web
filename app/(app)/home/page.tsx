import { currentUser } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";

export default async function HomePage() {
  const user = await currentUser();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.firstName || "there"}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Ready to build something amazing?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Sparkles className="h-8 w-8 text-primary" />
              <Button size="sm" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-lg">Create New App</CardTitle>
            <CardDescription>
              Start building your app with AI assistance
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Apps</CardTitle>
            <CardDescription>
              You haven't created any apps yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click "Create New App" to get started!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
            <CardDescription>
              Learn how to use Appily
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Tutorial
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg p-8 text-center">
        <Sparkles className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-semibold mb-2">
          Your app journey starts here
        </h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Create your first mobile app by chatting with AI.
          Just describe your idea and we'll help bring it to life.
        </p>
        <Button size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Create your first app
        </Button>
      </div>
    </div>
  );
}
