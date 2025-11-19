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
  const isIndividualProjectPage = pathname.match(/^\/home\/projects\/[^/]+$/);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {!isIndividualProjectPage && (
          <header className="flex h-12 shrink-0 items-center border-b px-4 gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <SidebarTrigger className="h-8 w-8" />
              <Separator orientation="vertical" className="h-4" />
              <AppBreadcrumbs />
            </div>
          </header>
        )}
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
