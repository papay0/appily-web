"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { PlusCircle, Smartphone, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Project {
  id: string;
  name: string;
  emoji?: string;
  created_at: string;
  updated_at: string;
}

interface ProjectListProps {
  projects: Project[];
  onCreateNew?: () => void;
}

export function ProjectList({ projects, onCreateNew }: ProjectListProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {onCreateNew && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Projects</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your mobile apps
            </p>
          </div>
          <Button onClick={onCreateNew} size="lg">
            <PlusCircle className="mr-2 h-5 w-5" />
            New Project
          </Button>
        </div>
      )}

      {/* Mobile: Table view */}
      <div className="md:hidden rounded-lg border bg-card">
        <Table>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => router.push(`/home/projects/build/${project.id}`)}
              >
                <TableCell className="py-3 px-3 w-8">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    {project.emoji ? (
                      <span className="text-base">{project.emoji}</span>
                    ) : (
                      <Smartphone className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 px-0 font-medium">
                  <span className="truncate block max-w-[180px]">{project.name}</span>
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
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/home/projects/build/${project.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {project.emoji ? (
                    <span className="text-xl">{project.emoji}</span>
                  ) : (
                    <Smartphone className="h-5 w-5 text-primary" />
                  )}
                </div>
              </div>
              <CardTitle className="mt-4">{project.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
