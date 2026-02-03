# 🚀 Quick Start Guide - Agentic CRM

## Overview

You've just received a **complete foundation** for an AI-powered CRM system. This guide will help you get up and running in minutes.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 18+** installed ([Download](https://nodejs.org/))
- ✅ **PostgreSQL 14+** running locally or in cloud
- ✅ **Git** (for version control)
- ⭐ **OpenAI API Key** (optional, for AI features later)
- ⭐ **Azure AD Tenant** (optional, for SSO)

---

## 🏗️ Installation Options

### **Option 1: Standard Install (Recommended)**

```bash
# Navigate to project
cd c:/Users/dip.bagchi/Downloads/QBA-Opportunity/agentic-crm

# Install all dependencies (may take 2-3 minutes)
npm install --legacy-peer-deps

# If above fails, try:
npm install --force
```

### **Option 2: React 18 (Most Stable)**

If you encounter dependency conflicts with React 19:

1. Edit `package.json`
2. Change React versions:
   ```json
   {
     "dependencies": {
       "react": "^18.3.1",
       "react-dom": "^18.3.1",
       "next": "^15.1.6"
     }
   }
   ```
3. Run: `npm install`

### **Option 3: Minimal Install**

Start with just core dependencies:

```bash
npm install next react react-dom
npm install @prisma/client lucide-react clsx
npm install -D prisma typescript @types/node @types/react
```

---

## ⚙️ Environment Setup

### 1. Create Environment File

```bash
# Copy the template
copy .env.example .env.local

# For Mac/Linux:
cp .env.example .env.local
```

### 2. Configure Database

Edit `.env.local` and set your PostgreSQL connection:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/agentic_crm"
```

**Common Connection Strings:**

```env
# Local PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/agentic_crm"

# Supabase
DATABASE_URL="postgresql://postgres.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"

# Neon
DATABASE_URL="postgresql://[user]:[password]@[region].neon.tech/[dbname]"

# Railway
DATABASE_URL="postgresql://postgres:[password]@[host].railway.app:[port]/railway"
```

### 3. Set Other Essentials

Update these in `.env.local`:

```env
# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-super-secret-key-here"

# App URL
NEXTAUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"

# (Optional) For AI features later
OPENAI_API_KEY="sk-..."

# (Optional) For Azure AD SSO
AZURE_AD_CLIENT_ID="..."
AZURE_AD_CLIENT_SECRET="..."
AZURE_AD_TENANT_ID="..."
```

---

## 🗄️ Database Setup

### Initialize Prisma

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# (Optional) Create first migration
npm run db:migrate
```

### Verify Database

```bash
# Open Prisma Studio to view your database
npm run db:studio
```

This opens a web UI at `http://localhost:5555` where you can:
- View all tables
- Add/edit/delete records
- Explore relationships

---

## 🏃 Run Development Server

```bash
npm run dev
```

**Expected output:**
```
▲ Next.js 16.1.6
- Local:        http://localhost:3000
- Network:      http://192.168.1.x:3000

✓ Ready in 2.3s
```

### Open Your Browser

Visit: **http://localhost:3000**

You should see the beautiful animated homepage!

---

## 🎨 What You'll See

### 1. **Homepage**
- Animated hero section with gradient text
- Feature showcase (AI capabilities)
- Premium glassmorphic design
- Smooth Framer Motion animations

### 2. **Design System**
All available in `app/globals.css`:
- `.btn-primary` - Primary action buttons
- `.btn-glass` - Glassmorphic buttons
- `.glass-card` - Elevated cards with blur
- `.text-gradient` - Gradient text effects
- `.badge-success`, `.badge-warning`, etc.

### 3. **Database Schema**
20+ models ready in `prisma/schema.prisma`:
- Users, Roles, Teams
- Opportunities, Clients, Contacts
- Activities, Tasks, Notes
- AI Interactions, Lead Scores
- Audit Logs

---

## 🛠️ Development Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to DB (no migrations)
npm run db:migrate       # Create and apply migration
npm run db:seed          # Run seed script (create later)
npm run db:studio        # Open Prisma Studio

# Testing (setup later)
npm run test             # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

---

## 📁 Project Structure

```
agentic-crm/
├── 📱 app/                       # Next.js App Router
│   ├── globals.css              # ✨ Premium design system
│   ├── layout.tsx               # Root layout with theme
│   ├── page.tsx                 # 🏠 Animated homepage
│   └── (dashboard)/             # 🔐 Protected routes (create next)
│       ├── layout.tsx
│       ├── opportunities/
│       ├── analytics/
│       └── admin/
├── 🧩 components/
│   ├── providers/
│   │   └── theme-provider.tsx   # Dark/light mode
│   ├── ui/                      # Radix UI components
│   │   ├── toast.tsx
│   │   └── toaster.tsx
│   └── [feature]/               # Feature components (create)
├── 🗄️ prisma/
│   ├── schema.prisma            # 💎 Complete data model
│   └── migrations/              # DB migrations
├── 🔧 lib/
│   ├── utils.ts                 # Helper functions
│   └── db.ts                    # Prisma client (create)
├── 🪝 hooks/
│   └── use-toast.ts             # Toast notifications
├── 📄 Configuration
│   ├── .env.example             # Environment template
│   ├── tailwind.config.ts       # Design tokens
│   ├── package.json             # Dependencies
│   └── tsconfig.json            # TypeScript config
└── 📚 Documentation
    ├── README.md                # Project overview
    ├── SETUP.md                 # Detailed setup
    ├── PROJECT_SUMMARY.md       # What we built
    └── .agent/artifacts/
        └── agentic_crm_implementation_plan.md
```

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] `npm run dev` starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Homepage animations work smoothly
- [ ] `npm run db:studio` opens Prisma Studio
- [ ] Can see database tables in Prisma Studio
- [ ] Dark/light mode toggle works (add button later)
- [ ] No TypeScript errors in IDE

---

## 🎯 Next Development Steps

### **Week 1: Authentication** 🔐

1. **Create login page**:
```bash
mkdir -p app/(auth)/login
```

Create `app/(auth)/login/page.tsx`:
```tsx
"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 to-neutral-900">
      <div className="glass-card-dark p-12 max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-gradient">
          Agentic CRM
        </h1>
        <button
          onClick={() => signIn("azure-ad")}
          className="btn-primary w-full"
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
```

2. **Configure NextAuth**:
   - See NextAuth.js docs for Azure AD setup
   - Create `app/api/auth/[...nextauth]/route.ts`

### **Week 2: Dashboard Layout** 📊

1. Create protected layout with sidebar navigation
2. Add user menu with logout
3. Build dashboard skeleton

### **Week 3-4: Opportunity Management** 💼

1. Create opportunity form (create/edit)
2. Build list view with filters
3. Add detail view
4. Implement file uploads

### **Week 5: Kanban Board** 🎯

1. Install `@hello-pangea/dnd` (already in package.json)
2. Build kanban columns (one per stage)
3. Implement drag-and-drop
4. Add stage transition validation

### **Week 6+: Advanced Features**

- Activities & Timeline
- Analytics Dashboard
- Workflow Engine
- AI Integration (LangChain)

---

## 🐛 Troubleshooting

### **npm install fails**

```bash
# Clear cache
npm cache clean --force

# Remove lock file
rm package-lock.json
rm -rf node_modules

# Try again
npm install --legacy-peer-deps
```

### **Database connection fails**

```bash
# Test PostgreSQL connection
psql -U postgres -h localhost

# Create database manually
createdb agentic_crm

# Update .env.local with correct credentials
```

### **Prisma errors**

```bash
# Reset Prisma
rm -rf node_modules/.prisma
npx prisma generate

# If schema issues
npx prisma validate
```

### **Port 3000 already in use**

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- -p 3001
```

### **TypeScript errors**

```bash
# Rebuild TypeScript
rm -rf .next

# Restart dev server
npm run dev
```

---

## 📚 Learning Resources

### **Next.js 16**
- [Official Docs](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

### **Prisma**
- [Docs](https://www.prisma.io/docs)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

### **NextAuth.js**
- [Getting Started](https://authjs.dev/getting-started)
- [Azure AD Provider](https://authjs.dev/reference/core/providers/azure-ad)

### **Tailwind CSS**
- [Docs](https://tailwindcss.com/docs)
- [Customization](https://tailwindcss.com/docs/configuration)

### **Radix UI**
- [Primitives](https://www.radix-ui.com/primitives)
- [Themes](https://www.radix-ui.com/themes)

---

## 🎓 Recommended Development Flow

1. **Start with Simplicity**: Don't build everything at once
2. **Test as You Go**: Use Prisma Studio to verify data
3. **Use TypeScript**: Let it catch errors early
4. **Follow the Plan**: Reference `agentic_crm_implementation_plan.md`
5. **Build UI First**: Static UI → Dynamic data → AI features
6. **Iterate**: Ship basic version, then enhance

---

## 🚀 Production Deployment (Later)

When ready to deploy:

### **Vercel** (Recommended for Next.js)
```bash
npm install -g vercel
vercel
```

### **Environment Variables**
Set all `.env.local` variables in your hosting platform:
- Vercel: Project Settings → Environment Variables
- Railway: Variables tab
- Azure: App Settings

### **Database**
Use managed PostgreSQL:
- [Supabase](https://supabase.com) (free tier available)
- [Neon](https://neon.tech) (serverless Postgres)
- [Railway](https://railway.app)
- Azure Database for PostgreSQL

---

## ✨ You're All Set!

The foundation is ready. Now start building:

```bash
# Start developing
npm run dev
```

Visit:
- **App**: http://localhost:3000
- **Database**: `npm run db:studio` → http://localhost:5555
- **Docs**: See PROJECT_SUMMARY.md and Implementation Plan

**Need help?** Check:
1. SETUP.md for installation issues
2. PROJECT_SUMMARY.md for architecture
3. Implementation Plan for roadmap

---

**Happy coding! Build something amazing! 🎉**
