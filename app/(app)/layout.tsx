"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { usePathname } from "next/navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Don't render header for individual project pages (they render ProjectHeader)
  // Match /home/projects/build/[id], /home/projects/plan/[id], or /home/projects/design/[id] patterns
  const isIndividualProjectPage = pathname.match(/^\/home\/projects\/(build|plan|design)\/[^/]+$/);

  return (
    <div className="fixed inset-0 overflow-hidden flex pt-safe pb-safe bg-background">
      <SidebarProvider defaultOpen={!isIndividualProjectPage}>
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          {!isIndividualProjectPage && (
            <header className="flex h-12 shrink-0 items-center border-b px-4 gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <SidebarTrigger className="h-8 w-8" />
                <Separator orientation="vertical" className="h-4" />
                <AppBreadcrumbs />
              </div>
            </header>
          )}
          <div className={isIndividualProjectPage ? "flex flex-1 flex-col overflow-hidden" : "flex-1 overflow-y-auto p-3 md:p-4"}>
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
