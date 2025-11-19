"use client";

import { Home, Sparkles, FolderKanban } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Home",
    url: "/home",
    icon: Home,
  },
  {
    title: "Projects",
    url: "/home/projects",
    icon: FolderKanban,
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Appily</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between px-2 py-2">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
          <DarkModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
