# 🚀 Appily Deployment Checklist

## ✅ Milestones 1 & 2 - COMPLETED

### What's Been Built:

- ✅ **Landing Page** (Milestone 1)
  - Non-technical, user-friendly copy
  - Warm light blue theme with dark mode support
  - Beautiful hero section with CTAs
  - Features section highlighting key benefits
  - Fully responsive design

- ✅ **Authentication** (Milestone 2)
  - Clerk v5 integration with Google OAuth
  - Next.js 16 `proxy.ts` implementation (latest best practice)
  - Sign-in and sign-up pages with Clerk components
  - Protected routes with automatic redirects

- ✅ **Authenticated App Layout** (Milestone 2)
  - Shadcn sidebar component (collapsible)
  - User profile with Clerk UserButton
  - Dark mode toggle in sidebar footer
  - Auto-generated breadcrumbs
  - Responsive layout

- ✅ **Supabase Integration**
  - Users table created with RLS policies
  - Supabase client and admin clients configured
  - Webhook endpoint ready for Clerk sync

---

## 📋 Post-Deployment Tasks

### 1. Configure Clerk Webhook (IMPORTANT!)

After deploying to Vercel (or your hosting platform), you need to set up the Clerk webhook:

**Steps:**

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Your Application → Webhooks
2. Click **"Add Endpoint"**
3. Enter your webhook URL:
   ```
   https://your-deployment-url.vercel.app/api/webhooks/clerk
   ```
4. Select these events:
   - ✅ `user.created`
   - ✅ `user.updated`
5. Click **"Create"**
6. Copy the **"Signing Secret"** (starts with `whsec_...`)
7. Add it to your environment variables:
   - **Vercel:** Project Settings → Environment Variables
   - **Local:** `.env.local`
   ```env
   CLERK_WEBHOOK_SECRET=whsec_your_signing_secret_here
   ```
8. Uncomment the webhook verification code in `/app/api/webhooks/clerk/route.ts` (lines 22-55)
9. **Redeploy** your application

---

### 2. Test the Full Authentication Flow

**Testing Checklist:**

- [ ] Visit landing page (`/`)
- [ ] Click "Get started" → Should redirect to sign-up
- [ ] Sign up with Google OAuth
- [ ] After sign-up, should redirect to `/home`
- [ ] Check if user appears in Supabase `users` table
- [ ] Sign out
- [ ] Try to visit `/home` → Should redirect to sign-in
- [ ] Sign in → Should redirect to `/home`
- [ ] Test dark mode toggle in sidebar
- [ ] Test sidebar collapse/expand
- [ ] Test breadcrumbs navigation

---

### 3. Environment Variables Checklist

**Required for Production:**

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...  # Replace with production key
CLERK_SECRET_KEY=sk_live_...                   # Replace with production key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/home
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/home

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Clerk Webhook (add after deployment)
CLERK_WEBHOOK_SECRET=whsec_...
```

⚠️ **Important:** Switch to Clerk's **production keys** before deploying to production!

---

### 4. Vercel Deployment

**Quick Deploy:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Then deploy to production
vercel --prod
```

**Or use the Vercel GitHub integration:**
1. Connect your GitHub repo to Vercel
2. Add environment variables in Project Settings
3. Push to main branch to auto-deploy

---

## 🎨 Theme & Design

**Color Palette:**
- Primary: Warm sky blue (`oklch(0.62 0.18 230)`)
- Background (Light): Soft blue-white (`oklch(0.99 0.005 240)`)
- Background (Dark): Deep blue-gray (`oklch(0.15 0.015 240)`)

**Typography:**
- Sans: Geist Sans
- Mono: Geist Mono

---

## 🗂️ Project Structure

```
/app
  /(marketing)
    page.tsx              # Landing page
  /(auth)
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
  /(app)
    layout.tsx            # Authenticated layout with sidebar
    home/page.tsx         # Home dashboard
  layout.tsx              # Root layout with Clerk + Theme providers
  api/
    webhooks/
      clerk/route.ts      # Clerk webhook handler

/components
  app-sidebar.tsx         # Main sidebar component
  app-breadcrumbs.tsx     # Auto-generated breadcrumbs
  dark-mode-toggle.tsx    # Theme switcher
  /ui                     # 53 Shadcn components

/lib
  supabase.ts            # Supabase clients

proxy.ts                 # Next.js 16 auth proxy
```

---

## 🐛 Troubleshooting

### Issue: Webhook not syncing users to Supabase
**Solution:**
1. Check webhook is configured in Clerk dashboard
2. Verify `CLERK_WEBHOOK_SECRET` is set correctly
3. Check webhook verification code is uncommented in `route.ts`
4. View webhook logs in Clerk dashboard for errors

### Issue: Dark mode not working
**Solution:**
1. Ensure `ThemeProvider` is in root layout
2. Check `suppressHydrationWarning` is on `<html>` tag
3. Clear browser cache and reload

### Issue: Redirects not working
**Solution:**
1. Check `proxy.ts` is in the root directory (not in `/app`)
2. Verify Clerk environment variables are set
3. Check proxy matcher config is correct

---

## 📝 Next Steps (Milestone 3+)

- [ ] Add project creation flow
- [ ] Implement AI chat interface
- [ ] Add code generation for React Native/Expo
- [ ] Create project management dashboard
- [ ] Add file explorer for generated code
- [ ] Implement preview functionality

---

## 🎉 You're All Set!

**To test locally:**
```bash
npm run dev
```

**To deploy:**
```bash
vercel --prod
```

Remember to configure the Clerk webhook after deployment! 🚀
