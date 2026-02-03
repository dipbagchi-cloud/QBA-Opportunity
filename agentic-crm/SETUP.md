# Agentic CRM - Setup Instructions

## Current Status

✅ **Created Foundation**:
- Next.js 16 project initialized
- Comprehensive Prisma database schema
- Premium UI design system with glassmorphism
- Tailwind CSS configuration with custom theming
- Environment variables template
- Implementation plan (21 weeks)

⚠️ **Dependency Installation Issue**:
Due to React 19 being very recent, some packages have peer dependency conflicts.

## Option 1: Simplified Installation (Recommended)

Install core dependencies first, then add advanced features:

```bash
cd agentic-crm

# Install only core Next.js dependencies
npm install next@latest react@latest react-dom@latest

# Install essential UI libraries
npm install @radix-ui/react-toast@latest lucide-react framer-motion clsx tailwind-merge

# Install Prisma
npm install @prisma/client@latest
npm install -D prisma@latest

# Install authentication
npm install next-auth@beta @auth/prisma-adapter

# Install forms and validation
npm install react-hook-form zod @hookform/resolvers

# Install development tools
npm install -D typescript @types/node @types/react @types/react-dom tsx

# Copy environment variables
copy .env.example .env.local
```

## Option 2: Use React 18 (Most Stable)

Edit `package.json` and downgrade React:

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "next": "^15.1.6"
  }
}
```

Then run:
```bash
npm install
```

## After Installation

1. **Setup Database**:
```bash
# Configure your PostgreSQL connection in .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/agentic_crm"

# Generate Prisma client
npm run db:generate

# Create database tables
npm run db:push

# (Optional) Run migrations
npm run db:migrate
```

2. **Configure Environment Variables**:
Edit `.env.local` and add:
- Azure AD credentials (for SSO)
- OpenAI API key (for AI features - add later)
- Database URL
- Other service credentials

3. **Run Development Server**:
```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Structure

```
agentic-crm/
├── app/                          # Next.js App Router
│   ├── globals.css              # ✅ Premium design system
│   ├── layout.tsx               # ✅ Root layout with theming
│   └── page.tsx                 # ✅ Beautiful homepage
├── components/                   # React components
│   ├── providers/               #  ✅ Theme provider
│   └── ui/                      # ✅ Toast component
├── lib/                         # Utilities
│   └── utils.ts                 # ✅ Helper functions
├── hooks/                       # React hooks
│   └── use-toast.ts             # ✅ Toast notifications
├── prisma/
│   └── schema.prisma            # ✅ Complete database schema
├── .env.example                 # ✅ Environment template
├── tailwind.config.ts           # ✅ Tailwind configuration
└── package.json                 # ✅ Dependencies

✅ = Already created
🔨 = Needs to be built
```

## What's Built

### 1. Database Schema (prisma/schema.prisma)
Complete data model with:
- User management & RBAC
- Clients & Contacts
- Opportunities & pipeline stages
- Activities, Tasks, Notes, Attachments
- Workflow & Approvals
- AI interactions & lead scoring
- Audit logs & compliance
- Vector embeddings (for RAG)

### 2. Design System (app/globals.css + tailwind.config.ts)
- Modern color palette (primary, secondary, accent, success, warning, danger)
- Glassmorphism components
- Premium gradients
- Smooth animations
- Responsive utilities
- Dark mode support

### 3. Homepage (app/page.tsx)
Beautiful animated landing page showcasing:
- Hero section with gradient text
- Feature cards with icons
- AI capabilities list
- CTA sections
- Smooth Framer Motion animations

### 4. Implementation Plan
21-week roadmap covering all 15 epics

## Next Steps

Choose your installation approach above, then start building:

1. **Phase 1** - Authentication (Week 1-2)
   - NextAuth.js with Azure AD
   - Login/logout pages
   - Protected routes

2. **Phase 2** - Core CRM (Week 3-5)
   - Opportunity CRUD
   - Pipeline views (list + kanban)
   - Master data management

3. **Phase 3** - AI Layer (Week 12-15)
   - Add LangChain dependencies
   - Implement RAG system
   - Create AI agents
   - Build chat interface

## Troubleshooting

**If npm install fails**:
1. Clear cache: `npm cache clean --force`
2. Delete `node_modules` and `package-lock.json`
3. Try: `npm install --legacy-peer-deps`
4. Or downgrade to React 18 (see Option 2)

**Prisma errors**:
- Make sure PostgreSQL is running
- Check DATABASE_URL format
- Add `?schema=public` if needed

## Resources

- [Implementation Plan](.agent/artifacts/agentic_crm_implementation_plan.md)
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [NextAuth.js Docs](https://authjs.dev)

---

**Ready to start?** Follow the installation steps above and then run `npm run dev`!
