# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Appily** is a vibe coding platform for creating native mobile apps using Expo and AI coding agents. This codebase implements **Milestones 1 & 2**: landing page, authentication, and authenticated app shell.

**Tech Stack:**
- Next.js 16.0.3 (App Router, React 19.2)
- Clerk v5 (authentication with Google OAuth)
- Supabase (database with MCP integration)
- Shadcn UI (53 components, "new-york" style)
- TailwindCSS v4 (with custom warm light blue theme)
- TypeScript 5

**Domain:** https://appily.dev

---

## Critical Architecture Decisions

### 1. Next.js 16: `proxy.ts` NOT `middleware.ts`

**IMPORTANT:** This project uses Next.js 16's new authentication pattern with `proxy.ts` in the root directory, NOT the legacy `middleware.ts` pattern.

**File:** `/proxy.ts`

Key implementation details:
- Uses `clerkMiddleware` from `@clerk/nextjs/server`
- Route matchers with `createRouteMatcher()`
- Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`
- Redirects authenticated users from `/` → `/home`
- Redirects unauthenticated users from protected routes → `/sign-in`
- Redirects authenticated users accessing auth pages → `/home`

```typescript
// proxy.ts pattern (NOT middleware.ts)
export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  // Custom redirect logic here
})
```

### 2. Route Groups Architecture

The app uses Next.js route groups for logical separation:

```
/app
  /(marketing)/          # Public landing page
    page.tsx
  /(auth)/              # Clerk authentication pages
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
  /(app)/               # Authenticated app shell
    layout.tsx          # Sidebar + breadcrumbs layout
    home/page.tsx       # Main dashboard
  /api/webhooks/clerk/  # Clerk → Supabase sync
  layout.tsx            # Root: ClerkProvider + ThemeProvider
  globals.css           # TailwindCSS v4 theme
```

**Why route groups?** They allow different layouts without affecting URL structure. The `/home` route gets the sidebar layout, while `/` gets a clean marketing layout.

### 3. Clerk v5 Authentication Flow

**Current setup:**
- Uses prebuilt Clerk components: `<SignIn />`, `<SignUp />`, `<UserButton />`
- Catch-all routes: `[[...sign-in]]` and `[[...sign-up]]` for Clerk's multi-step flows
- Environment variables control redirect behavior (see `.env.example`)

**Environment variables:**
```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/home
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/home
```

### 4. Supabase Integration & Webhook Setup

**Database Schema:**
```sql
-- Table: users
id uuid PRIMARY KEY
clerk_id text UNIQUE NOT NULL
email text
first_name text
last_name text
avatar_url text
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

**Webhook Sync Pattern:**
- **File:** `/app/api/webhooks/clerk/route.ts`
- **Events:** `user.created`, `user.updated`
- **Current state:** Webhook verification is COMMENTED OUT for local development
- **Deployment requirement:** Uncomment verification code (lines 22-55) and add `CLERK_WEBHOOK_SECRET`

**Two Supabase clients:**
```typescript
// lib/supabase.ts
export const supabase = createClient(url, anonKey)  // Client-side
export const supabaseAdmin = createClient(url, serviceRoleKey)  // Server-side (webhooks)
```

### 5. Theming System: Warm Light Blue Palette

**Implementation:** TailwindCSS v4 with OKLCH color space in `app/globals.css`

**Color palette:**
- Primary: `oklch(0.62 0.18 230)` (light mode) / `oklch(0.70 0.18 220)` (dark mode)
- Background: `oklch(0.99 0.005 240)` (light) / `oklch(0.15 0.015 240)` (dark)
- Warm, low-saturation blues throughout

**Dark mode:**
- Uses `next-themes` with `ThemeProvider` in root layout
- `suppressHydrationWarning` on `<html>` tag to prevent flash
- Toggle component: `/components/dark-mode-toggle.tsx` (simple click to toggle, no dropdown)

**Custom variant:**
```css
@custom-variant dark (&:is(.dark *));
```

---

## Development Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

**User preferences:**
- Never commit and push unless explicitly asked
- Let the user run `npm run dev` themselves
- Only run `npm run build` when not too confident of code

---

## Key Components & Patterns

### Shadcn UI Components (53 total)

**Installed components:** accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button-group, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, field, form, hover-card, input-group, input-otp, input, item, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle-group, toggle, tooltip

**Configuration:** `components.json`
- Style: "new-york"
- RSC: true
- Icon library: lucide-react
- Aliases: `@/components`, `@/lib`, `@/hooks`, `@/ui`

### App Sidebar Pattern

**File:** `/components/app-sidebar.tsx`

Uses Shadcn's `Sidebar` component with:
- Header with Sparkles icon + "Appily" branding
- Collapsible behavior built-in (uses `SidebarProvider` context)
- Footer with `UserButton` (Clerk) + `DarkModeToggle`
- Menu items array for easy extension (currently just "Home")

**Layout integration:**
```tsx
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <header><SidebarTrigger /><AppBreadcrumbs /></header>
    {children}
  </SidebarInset>
</SidebarProvider>
```

### Auto-Generated Breadcrumbs

**File:** `/components/app-breadcrumbs.tsx`

Pattern:
- Uses `usePathname()` from Next.js navigation
- Splits path into segments
- Capitalizes and formats segment names (replaces `-` with space)
- Always starts with "Home" link
- Last segment is non-clickable `<BreadcrumbPage>`

### TypeScript Path Aliases

All imports use `@/` prefix:
```typescript
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
```

Configured in `tsconfig.json`: `"@/*": ["./*"]`

---

## Important Patterns Not Obvious from File Names

### 1. Server Components by Default

The app uses React Server Components everywhere except:
- Components using hooks (`"use client"` directive)
- `app-sidebar.tsx`, `app-breadcrumbs.tsx`, `dark-mode-toggle.tsx`

**Home page uses server-side Clerk:**
```typescript
// app/(app)/home/page.tsx
import { currentUser } from "@clerk/nextjs/server"

export default async function HomePage() {
  const user = await currentUser()  // Server-side, no client JS needed
}
```

### 2. No RLS Bypass (Yet)

The users table has RLS policies, but current implementation uses `supabaseAdmin` (service role key) in webhooks to bypass RLS. Future user-authenticated queries should use the regular `supabase` client.

### 3. Clerk Catch-All Routes

The `[[...sign-in]]` syntax is crucial for Clerk's multi-step flows (OAuth redirects, verification, etc.). Don't flatten these routes.

### 4. Font Loading with Geist

Uses Next.js `next/font` with Geist Sans and Geist Mono:
```typescript
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
```

Applied as CSS variables in root layout, then mapped in `globals.css`.

### 5. TailwindCSS v4 Inline Theme

Uses `@theme inline` directive with CSS custom properties:
```css
@theme inline {
  --color-primary: var(--primary);
  --radius-lg: var(--radius);
}
```

This is TailwindCSS v4 syntax, NOT v3.

---

## Supabase MCP Integration

**IMPORTANT:** Always use the Supabase MCP tools for database operations. The MCP connection is pre-configured.

Available MCP tools:
- `mcp__supabase__apply_migration` - Create database migrations
- `mcp__supabase__execute_sql` - Run SQL queries
- `mcp__supabase__list_tables` - List all tables
- `mcp__supabase__get_advisors` - Check for security/performance issues

**Example migration created:**
```sql
-- supabase/migrations/create_users_table.sql
create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  -- ... other fields
);
```

---

## Deployment Checklist

**Critical post-deployment steps:**

1. **Configure Clerk Webhook** (MOST IMPORTANT)
   - Go to Clerk Dashboard → Webhooks → Add Endpoint
   - URL: `https://your-deployment.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`
   - Copy signing secret → Add `CLERK_WEBHOOK_SECRET` to Vercel env vars
   - Uncomment verification code in `/app/api/webhooks/clerk/route.ts` (lines 22-55)
   - Redeploy

2. **Switch to Clerk Production Keys**
   - Replace `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` with `pk_live_...`
   - Replace `CLERK_SECRET_KEY` with `sk_live_...`

3. **Verify Supabase Environment Variables**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

See `/ai-agents-documents/DEPLOYMENT-CHECKLIST.md` for full details.

---

## User Copy Guidelines

**IMPORTANT:** All user-facing copy must be non-technical and accessible to non-developers.

**Good examples:**
- "Turn your ideas into real iOS and Android apps"
- "No coding required, no technical knowledge needed"
- "Chat with AI to design your app"

**Bad examples:**
- "Build apps with Expo"
- "Create React Native applications"
- Technical jargon like "runtime", "SDK", "API"

This is a platform for non-technical creators. Keep all copy simple, friendly, and focused on outcomes, not implementation details.

---

## Future Work (Milestone 3+)

Not implemented yet:
- Project creation flow
- AI chat interface with Claude Code SDK
- E2B containerized coding environments
- Code generation for React Native/Expo
- File explorer for generated code
- App preview functionality

**Do NOT implement these without explicit instructions.**

---

## Common Gotchas

1. **Don't create `middleware.ts`** - This breaks the Next.js 16 proxy pattern
2. **Webhook verification is commented out** - Intentional for local dev, must uncomment for production
3. **No RLS policies created yet** - Users table exists but needs RLS before multi-tenancy
4. **Route groups don't affect URLs** - `(app)/home/page.tsx` maps to `/home`, not `/app/home`
5. **Server components can't use hooks** - Add `"use client"` when using `useState`, `usePathname`, etc.
6. **Dark mode requires suppressHydrationWarning** - Already added to root `<html>` tag
7. **Dark mode toggle is single-click** - No dropdown menu, just toggles between light/dark (no system option)

---

## References

- **Technical PRD:** `/ai-agents-documents/appily-technical-prd-v1.md`
- **Deployment Guide:** `/ai-agents-documents/DEPLOYMENT-CHECKLIST.md`
- **Environment Template:** `/.env.example`
- **Shadcn Config:** `/components.json`

---

**Last Updated:** 2025-11-18 (Milestone 2 complete)
- Never git commit unless I tell you to do it
- Never git push unless I tell you to do it
- Never run `npm run dev` unless I tell you to do it
- Only run `npm run build` when you're not too certain of your changes. For instance if you do a simple UI change, no need to do it. If it's a complex change you should do it.