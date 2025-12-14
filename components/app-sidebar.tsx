"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, FolderKanban } from "lucide-react";
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/home" className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:opacity-80 transition-opacity">
          <Image
            src="/appily-logo.svg"
            alt="Appily Logo"
            width={24}
            height={24}
          />
          <span className="text-xl font-bold group-data-[collapsible=icon]:hidden">Appily</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
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
        <div className="flex items-center justify-between px-2 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
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
