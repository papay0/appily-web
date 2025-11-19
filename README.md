# Appily

**A vibe coding platform for creating native mobile apps using Expo and AI coding agents.**

Turn your ideas into real iOS and Android apps through natural conversation with AI. No technical knowledge required.

🌐 **Live Demo:** [appily.dev](https://appily.dev)

---

## ✨ Features

- 🎨 **Visual App Builder** - Create mobile apps through chat-based interface
- 📱 **Native Mobile Apps** - Build real iOS & Android apps with Expo/React Native
- 🤖 **AI-Powered Coding** - Claude AI generates code based on your descriptions
- ⚡ **Live Preview** - Scan QR code with Expo Go to preview your app instantly
- 💾 **Project Management** - Save, edit, and manage multiple app projects
- 🔒 **Secure & Private** - Your projects are protected with row-level security

---

## 🚀 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, React 19)
- **Authentication:** [Clerk](https://clerk.com) with Google OAuth
- **Database:** [Supabase](https://supabase.com) with PostgreSQL
- **UI Components:** [Shadcn UI](https://ui.shadcn.com) + [TailwindCSS v4](https://tailwindcss.com)
- **Code Execution:** [E2B](https://e2b.dev) sandboxed environments
- **Code Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) (VSCode-like)
- **AI:** Claude via [Anthropic API](https://www.anthropic.com/api) *(coming soon)*
- **Deployment:** [Vercel](https://vercel.com)

---

## 📦 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Clerk](https://clerk.com) account (free tier available)
- A [Supabase](https://supabase.com) project (free tier available)
- An [E2B](https://e2b.dev) API key (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/appily.git
cd appily
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/home
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/home

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# E2B Code Interpreter (Server-side only)
E2B_API_KEY=your_e2b_api_key

# Clerk Webhook (Add after deployment)
CLERK_WEBHOOK_SECRET=whsec_...
```

### 3. Set Up Supabase Database

The project uses Supabase for data storage. Run the migrations:

```bash
# Install Supabase CLI (if you haven't already)
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

Or manually run the SQL from `supabase/migrations/` in your Supabase SQL Editor.

### 4. Set Up Clerk Webhook (Important!)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
2. Click **Add Endpoint**
3. Enter your webhook URL: `http://localhost:3000/api/webhooks/clerk` (for local dev)
4. Subscribe to events: `user.created`, `user.updated`
5. Copy the **Signing Secret** and add to `.env.local`:
   ```env
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app!

---

## 🏗️ Project Structure

```
appily-web/
├── app/
│   ├── (marketing)/          # Public landing page
│   ├── (auth)/               # Clerk sign-in/sign-up pages
│   ├── (app)/                # Authenticated app routes
│   │   └── home/
│   │       ├── page.tsx      # Project list
│   │       └── projects/[id] # Coding interface
│   └── api/
│       ├── sandbox/          # E2B sandbox management
│       └── webhooks/         # Clerk user sync
├── components/               # React components
│   ├── ui/                   # Shadcn UI components
│   ├── project-*.tsx         # Project management
│   ├── chat-panel.tsx        # AI chat interface
│   ├── preview-panel.tsx     # QR code + preview
│   └── code-editor.tsx       # Monaco editor
├── lib/
│   ├── supabase.ts           # Supabase client (client-side)
│   ├── supabase-admin.ts     # Supabase admin (server-side)
│   └── e2b.ts                # E2B sandbox utilities
├── supabase/
│   └── migrations/           # Database schema migrations
└── proxy.ts                  # Next.js 16 auth middleware
```

---

## 🗄️ Database Schema

### Tables

**users**
- `id` (uuid, PK)
- `clerk_id` (text, unique) - Synced from Clerk
- `email`, `first_name`, `last_name`, `avatar_url`
- `created_at`, `updated_at`

**projects**
- `id` (uuid, PK)
- `user_id` (uuid, FK to users)
- `name` (text) - App name
- `e2b_sandbox_id` (text, nullable) - Active sandbox
- `created_at`, `updated_at`

All tables have **Row-Level Security (RLS)** enabled for user isolation.

---

## 🔐 Security Notes

- **Never commit `.env.local`** - It's in `.gitignore` for a reason!
- **E2B API key** is server-side only (no `NEXT_PUBLIC_` prefix)
- **Supabase Service Role Key** is only used in API routes
- **Clerk Webhook Secret** must be configured for production

---

## 🚢 Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/appily)

1. Click the button above or connect your GitHub repo to Vercel
2. Add all environment variables from `.env.example`
3. Deploy!

### Post-Deployment Steps

1. **Update Clerk Webhook URL:**
   - Clerk Dashboard → Webhooks → Edit endpoint
   - Change URL to: `https://your-app.vercel.app/api/webhooks/clerk`

2. **Add Environment Variables to Vercel:**
   - Vercel Dashboard → Settings → Environment Variables
   - Add all variables from `.env.example`
   - **Important:** Add `CLERK_WEBHOOK_SECRET` from Clerk Dashboard

3. **Redeploy** after adding environment variables

---

## 🛠️ Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

---

## 📝 Milestones & Roadmap

### ✅ Milestone 1: Landing Page
- Beautiful, responsive landing page
- Dark mode support
- Clerk authentication integration

### ✅ Milestone 2: App Shell
- Authenticated layout with sidebar
- User profile + dark mode toggle
- Auto-generated breadcrumbs
- Clerk → Supabase user sync

### ✅ Milestone 3: Project Management + E2B
- Create and manage app projects
- 3-panel coding interface (chat, preview, code)
- E2B sandbox integration
- Monaco code editor
- Debug panel for E2B monitoring

### 🚧 Milestone 4: AI Chat Integration *(In Progress)*
- Claude AI chat interface
- Natural language → code generation
- Real-time code updates

### 🔜 Upcoming Features
- QR code generation for Expo preview
- Live app preview in browser
- Expo project scaffolding
- File system sync with E2B
- Code export & download
- Template library
- Collaborative editing

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- UI components by [Shadcn](https://ui.shadcn.com)
- Authentication by [Clerk](https://clerk.com)
- Database by [Supabase](https://supabase.com)
- Code execution by [E2B](https://e2b.dev)
- AI by [Anthropic Claude](https://anthropic.com)

---

## 📧 Support

- **Documentation:** Check `/ai-agents-documents/` for detailed docs
- **Issues:** [GitHub Issues](https://github.com/yourusername/appily/issues)
- **Website:** [appily.dev](https://appily.dev)

---

**Made with ❤️ and AI**
