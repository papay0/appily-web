# appily-technical-prd-v1.md

# **Appily – Technical Product Requirements Document (Milestone 1 & 2)**  
**Version:** 1.0  
**Domain:** https://appily.dev  
**Date:** 2025  

Appily is a **vibe coding platform** to create **native mobile apps** using **Expo** and AI coding agents.  
This PRD covers **Milestone 1** (Landing Page) and **Milestone 2** (Authentication + App Layout).

Milestone 3+ (project creation, E2B containers, Claude Code agents, coding flow, etc.) will be added later.

---

# **1. Product Overview**
Appily lets users visually and conversationally build **React Native / Expo apps**, similar to Lovable but fully focused on native mobile.

Core tech stack:

- **Next.js 16 (App Router)**
- **Supabase** with **MCP** for agent communication  
- **Clerk** for authentication  
- **Shadcn/UI** for components  
- **TailwindCSS**
- **E2B** for containerized AI coding environments  
- **Claude Code SDK** for the AI coding agent  
- **Deployment:** Vercel

Milestone 1 and 2 establish the foundation:  
Landing page → Authentication → Authenticated shell → Smart routing.

---

# **2. Goals**

### **Milestone 1 (Landing Page)**
- A clean, warm, inspiring landing page for Appily.
- Should include:
  - Hero section with real copy
  - Basic explanation of the product
  - CTA: “Start building”
  - Sign in button (Clerk)
  - Light/dark mode toggle
- Responsive, fast, and minimal.

### **Milestone 2 (Authentication + Layout)**
- Add Clerk authentication + middleware + routing rules.
- `/` is public.  
- `/home` is authenticated.
- Authenticated users visiting `/` redirect → `/home`.
- Unauthenticated users visiting any route ≠ `/` redirect → Clerk's sign-in page.
- Create the authenticated app shell:
  - Sidebar using Shadcn
  - Collapsible with icons-only collapsed state
  - User profile block at bottom
  - Dark mode toggle at bottom
  - Header with breadcrumbs
- Routing auto-generates breadcrumbs based on URL segments.
- Basic Supabase user table initialized.

---

# **3. Non-Goals (Milestone 1 & 2)**

- No project creation UI  
- No Expo code generation  
- No AI agent execution  
- No E2B or container setup  
- No billing or pricing page  
- No marketing sections beyond hero & intro  

---

# **4. System Requirements**

---

## **4.1 Routing Requirements**

### **Public route**
- `/` → Landing Page

### **Authenticated route**
- `/home` → Main application shell

### **Redirection Rules**
| Condition | Behavior |
|----------|----------|
| User authenticated & visits `/` | Redirect → `/home` |
| User unauthenticated & visits any route except `/` or `/sign-in` | Redirect → Clerk sign-in |
| Access to Clerk sign-in allowed | Yes |

---

## **4.2 Layout Requirements**

### **Landing Page Layout (Public)**  
- Simple nav (logo + sign in button)  
- Hero section:
  - Title: “Build native apps with AI.”
  - Subtitle: “Appily lets you create fully functional iOS and Android apps in minutes with Expo and AI-powered vibe coding.”
  - CTA: “Start building” → `/sign-in`
- Screenshot placeholder
- Warm light blue palette
- Dark mode support

---

### **App Layout (Authenticated `/home`)**

Structure:

```
/home
  layout.tsx
  page.tsx
```

### **Sidebar Requirements**
- Uses shadcn Sidebar  
- Collapsible  
- Empty main list  
- Bottom section:
  - User profile
  - Dark mode toggle  

### **Header / Breadcrumbs**
- Auto-generated from route segments  
- Human-readable mapping  

---

## **4.3 Authentication Requirements**

- Use Clerk’s prebuilt components  
- `<ClerkProvider>` wrapping the app  
- Middleware protecting routes  

---

## **4.4 Supabase Requirements**

### **Table: users**
- `id` uuid PK  
- `clerk_id` text unique  
- timestamps  

### **Sync**
Upon first login, create user row.

---

# **5. Architecture Specification**

```
/app
  /(marketing)
    page.tsx
    layout.tsx
  /(auth)
    sign-in/
    sign-up/
  /(app)
    home/
      layout.tsx
      page.tsx
  globals.css
  middleware.ts
/components
  sidebar.tsx
  breadcrumbs.tsx
  /ui
/lib
  supabase.ts
  auth.ts
```

---

# **6. UI/UX Requirements**

### **Theme System**
- next-themes  
- warm light blue palette  
- dark mode  

### **Landing Copy**

**Title:** Build native mobile apps with AI.  
**Subtitle:** Appily lets anyone create production-ready iOS and Android apps using Expo — no setup, no complexity, just vibe code with AI.  
**CTA:** Start building  

---

# **7. Middleware & Auth Logic**

```ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/"],
  ignoredRoutes: ["/sign-in(.*)", "/sign-up(.*)"],
  afterAuth(auth, req) {
    const url = new URL(req.nextUrl);

    if (auth.userId && url.pathname === "/") {
      url.pathname = "/home";
      return Response.redirect(url);
    }

    if (!auth.userId && url.pathname !== "/") {
      url.pathname = "/sign-in";
      return Response.redirect(url);
    }
  }
});

export const config = {
  matcher: ["/((?!_next|static|.*\..*).*)"],
};
```

---

# **8. Code Scaffolding**

## **Landing Page**

```tsx
// app/(marketing)/page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center p-8">
      <h1 className="text-5xl font-bold mb-4">
        Build native mobile apps with AI.
      </h1>

      <p className="text-lg text-muted-foreground max-w-2xl mb-8">
        Appily lets anyone create production-ready iOS and Android apps
        using Expo. No setup. No friction. Just vibe code with AI.
      </p>

      <Link href="/sign-in">
        <Button size="lg">Start building</Button>
      </Link>
    </main>
  );
}
```

---

## **Authenticated Layout**

```tsx
// app/(app)/home/layout.tsx
import Sidebar from "@/components/sidebar";
import Breadcrumbs from "@/components/breadcrumbs";

export default function HomeLayout({ children }) {
  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <header className="border-b p-4">
          <Breadcrumbs />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

---

## **Sidebar**

```tsx
// components/sidebar.tsx
"use client";

import { useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { DarkModeToggle } from "@/components/darkmode-toggle";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useUser();

  return (
    <aside
      className={
        `border-r flex flex-col transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`
      }
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 border-b"
      >
        {collapsed ? "<" : ">"}
      </button>

      <div className="flex-1 p-4">
        {/* Empty for now */}
      </div>

      <div className="p-4 border-t space-y-4">
        <DarkModeToggle />
        <div className="flex items-center space-x-2">
          <UserButton afterSignOutUrl="/" />
          {!collapsed && (
            <div className="text-sm">
              <p>{user?.fullName}</p>
              <p className="text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
```

---

## **Breadcrumbs**

```tsx
// components/breadcrumbs.tsx
"use client";

import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="text-sm text-muted-foreground">
      {segments.length === 0
        ? "Home"
        : ["Home", ...segments.slice(1)]
            .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
            .join(" / ")}
    </nav>
  );
}
```

---

# **9. Supabase Schema**

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

# **10. Acceptance Criteria**

### **Milestone 1**
- Landing page deployed  
- Dark mode works  
- Responsive  
- CTA routes to sign-in  

### **Milestone 2**
- Middleware redirects correct  
- `/home` loads authenticated shell  
- Sidebar collapses  
- User profile + dark mode toggle at bottom  
- Breadcrumbs work  
- Supabase user row created  

---

# **End of Document**
