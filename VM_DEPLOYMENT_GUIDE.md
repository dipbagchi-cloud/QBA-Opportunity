# Q-CRM — VM Deployment Guide

> **Last Updated:** May 14, 2026  
> **Production URL:** https://qcrm.qbadvisory.com  
> **VM Host:** Azure Standard_D4s_v3 — IP `20.124.178.41`

---

## 1. Infrastructure Overview

### Azure VM Specifications

| Property | Value |
|----------|-------|
| **VM Size** | Standard_D4s_v3 |
| **vCPUs** | 4 |
| **RAM** | 16 GB |
| **OS Disk** | 64 GB (24% used) |
| **OS** | Ubuntu 22.04 LTS (6.8.0-1052-azure) |
| **Public IP** | 20.124.178.41 |
| **SSH User** | `azureuser` |
| **Hostname** | QCRM |

### Software Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | v20.20.0 | Runtime |
| **npm** | 10.8.2 | Package manager |
| **PM2** | 6.0.14 | Process manager |
| **Nginx** | 1.18.0 | Reverse proxy + SSL termination |
| **PostgreSQL** | 14.22 | Database |
| **Certbot** | (managed) | SSL certificate auto-renewal |
| **Next.js** | 15.5.15 | Frontend framework |
| **Express.js** | 4.x + TypeScript | Backend framework |
| **Prisma** | ORM | Database access layer |

---

## 2. Directory Structure

```
/home/azureuser/app/
├── agentic-crm/              # Next.js frontend (port 3000)
│   ├── .env.local            # Frontend environment
│   ├── .next/                # Build output
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # Shared React components
│   ├── lib/                  # Utilities (gom-calculator, rate-cards, api)
│   ├── hooks/                # Custom React hooks
│   └── public/               # Static assets
├── backend/                  # Express.js backend (port 3001)
│   ├── .env                  # Backend environment
│   ├── src/                  # TypeScript source
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/        # Auth, validation
│   │   ├── lib/              # Notification engine, intelligence
│   │   ├── routes/           # Express route definitions
│   │   └── services/         # Auth service, email service
│   ├── prisma/               # Schema + migrations
│   ├── dist/                 # Compiled JS output
│   └── uploads/              # File attachments
├── q-crm-mobile/             # React Native mobile app (development)
├── tests/                    # Selenium + API tests
├── nginx_qcrm.conf           # Reference nginx config
└── nginx_qcrm_updated.conf   # Latest nginx config
```

---

## 3. Environments

The VM hosts **3 environments** via separate PM2 processes and Nginx server blocks:

| Environment | Frontend Port | Backend Port | Domain | Nginx Site |
|-------------|---------------|--------------|--------|------------|
| **Production** | 3000 | 3001 | qcrm.qbadvisory.com | `/etc/nginx/sites-enabled/qcrm` |
| **QA** | 3002 | 3003 | qa.qcrm.qbadvisory.com | `/etc/nginx/sites-enabled/qcrm-qa` |
| **UAT** | 3004 | 3005 | uat.qcrm.qbadvisory.com | `/etc/nginx/sites-enabled/qcrm-uat` |

### PM2 Process Map

| PM2 ID | Name | CWD | Script |
|--------|------|-----|--------|
| 0 | `qcrm-backend` | `/home/azureuser/app/backend` | `npm start` |
| 1 | `qcrm-frontend` | `/home/azureuser/app/agentic-crm` | `npm start` |
| 2 | `qcrm-uat-backend` | (UAT backend path) | `npm start` |
| 3 | `qcrm-uat-frontend` | (UAT frontend path) | `npm start` |
| 4 | `qcrm-qa-backend` | (QA backend path) | `npm start` |
| 5 | `qcrm-qa-frontend` | (QA frontend path) | `npm start` |

---

## 4. Environment Variables

### Backend (`/home/azureuser/app/backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (database: `agentic_crm`) |
| `PORT` | Backend listen port (3001) |
| `FRONTEND_URL` | Production frontend URL (https://qcrm.qbadvisory.com) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `SMTP_HOST` | Email server host |
| `SMTP_PORT` | Email server port |
| `SMTP_SECURE` | TLS enabled |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender email address |
| `SMTP_FROM_NAME` | Sender display name |
| `OPENAI_API_KEY` | OpenAI API key for AI chatbot |
| `AZURE_AD_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_AD_CLIENT_ID` | Azure AD app registration client ID |
| `AZURE_AD_CLIENT_SECRET` | Azure AD client secret |
| `AZURE_AD_REDIRECT_URI` | SSO callback URL |
| `QPEOPLE_API_TOKEN` | QPeople HR system API token |

### Frontend (`/home/azureuser/app/agentic-crm/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (https://qcrm.qbadvisory.com) |

---

## 5. Git Configuration

| Property | Value |
|----------|-------|
| **Remote** | `origin` → `git@github.com:QuantumBusinessAdvisory/QCRM.git` |
| **Active Branch** | `Opportunity_MVC` |
| **Other Branches** | `deployment` |

### Local Development Remotes (Windows workstation)

| Remote | URL |
|--------|-----|
| `qcrm` | `git@github.com:QuantumBusinessAdvisory/QCRM.git` |
| `origin` | `git@github.com:dipbagchi-cloud/QBA-Opportunity.git` |

---

## 6. Nginx Configuration

**File:** `/etc/nginx/sites-enabled/qcrm`

### Key Settings

```nginx
server {
    server_name qcrm.qbadvisory.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Block CVE-2025-29927 (Next.js middleware bypass)
    if ($http_x_middleware_subrequest) {
        return 403;
    }

    # Static assets — cache forever (content-hashed filenames)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # HTML pages — never cache (prevents ChunkLoadError after deploys)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:3001;
    }

    # SSL (Certbot managed)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/qcrm.qbadvisory.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qcrm.qbadvisory.com/privkey.pem;
}
```

### Why `no-store` on HTML

After each frontend deploy, Next.js generates new JS chunk filenames. If browsers cache the old HTML, they request non-existent chunks → `ChunkLoadError` → screen "dancing". The `no-store` header + `error.tsx` cache-bust reload fixes this permanently.

---

## 7. Database

| Property | Value |
|----------|-------|
| **Engine** | PostgreSQL 14.22 |
| **Database** | `agentic_crm` |
| **ORM** | Prisma |
| **Schema** | `backend/prisma/schema.prisma` |

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles, teams, SSO |
| `opportunities` | Core CRM entity — deals/leads |
| `stages` | Pipeline stages (Discovery → Closed Won/Lost) |
| `rate_cards` | Resource CTC rates by skill/experience |
| `system_config` | Budget assumptions, auth mode, app settings |
| `notification_rules` | Email/in-app notification triggers |
| `notifications` | In-app notification history |
| `audit_logs` | All system actions for compliance |
| `currency_rates` | Exchange rates for multi-currency |
| `gom_approvals` | GOM approval workflow records |
| `clients` | Client/company records |
| `contacts` | Contact persons linked to clients |

### Common DB Operations

```bash
# Connect to DB
psql -U postgres -d agentic_crm

# Run migrations
cd /home/azureuser/app/backend && npx prisma migrate deploy

# Generate Prisma client
cd /home/azureuser/app/backend && npx prisma generate

# Open Prisma Studio (dev only)
cd /home/azureuser/app/backend && npx prisma studio
```

---

## 8. SSH Access

### From Windows (PowerShell)

```powershell
# SSH config entry (~/.ssh/config)
Host qcrm
    HostName 20.124.178.41
    User azureuser
    IdentityFile ~/.ssh/qcrm_key

# Connect
ssh qcrm
```

### SCP File Upload

```powershell
# Normal files
scp local/file.ts qcrm:/home/azureuser/app/agentic-crm/path/file.ts

# Files with [id] in path (PowerShell glob issue)
Get-Content -LiteralPath "local\path\[id]\file.tsx" -Raw | ssh qcrm "cat > '/home/azureuser/app/agentic-crm/app/dashboard/opportunities/[id]/file.tsx'"
```

---

## 9. Deployment Procedures

### Frontend Deployment (Next.js)

```bash
# 1. Stop frontend
pm2 stop qcrm-frontend
fuser -k 3000/tcp 2>/dev/null

# 2. Clean build (recommended for production)
cd /home/azureuser/app/agentic-crm
rm -rf .next
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'  # Free RAM for build

# 3. Build with increased memory
NODE_OPTIONS='--max-old-space-size=3072' npx next build

# 4. Restart
pm2 restart qcrm-frontend

# 5. Verify
curl -s -o /dev/null -w 'Frontend: %{http_code}\n' http://localhost:3000/
# Expected: 307 (redirect to login)
```

**Build time:** ~3-5 minutes on Standard_D4s_v3 (4 vCPUs, 16GB RAM).  
**Memory note:** `--max-old-space-size=3072` is required — default Node heap is too small for the Next.js build.

### Backend Deployment (Express + TypeScript)

```bash
# 1. Compile TypeScript
cd /home/azureuser/app/backend
npx tsc --skipLibCheck

# 2. Restart
pm2 restart qcrm-backend

# 3. Verify
curl -s -o /dev/null -w 'Backend: %{http_code}\n' http://localhost:3001/api/health
# Expected: 401 (auth required = healthy)
```

**Note:** `--skipLibCheck` is needed due to pre-existing type declaration issues in third-party packages. The compiled JS is functionally correct.

### Full Deployment (One-liner from Windows)

```powershell
# Upload files, build, restart (frontend)
ssh qcrm "pm2 stop qcrm-frontend; fuser -k 3000/tcp 2>/dev/null; cd /home/azureuser/app/agentic-crm && rm -rf .next && sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches' && NODE_OPTIONS='--max-old-space-size=3072' npx next build && pm2 restart qcrm-frontend"

# Backend compile + restart
ssh qcrm "cd /home/azureuser/app/backend && npx tsc --skipLibCheck --noEmitOnError false 2>/dev/null; pm2 restart qcrm-backend"
```

### Database Migration Deployment

```bash
cd /home/azureuser/app/backend
npx prisma migrate deploy       # Apply pending migrations
npx prisma generate             # Regenerate client
pm2 restart qcrm-backend        # Restart to pick up new client
```

---

## 10. Monitoring & Troubleshooting

### PM2 Commands

```bash
pm2 list                        # All process statuses
pm2 logs qcrm-frontend          # Live frontend logs
pm2 logs qcrm-backend           # Live backend logs
pm2 logs qcrm-frontend --lines 50  # Last 50 lines
pm2 monit                       # CPU/Memory dashboard
pm2 restart all                 # Restart everything
pm2 save                        # Save process list for auto-restart
```

### Health Checks

```bash
# Frontend (should return 307 redirect)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/

# Backend (should return 401 - auth required)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/api/health

# SSL check
curl -s -o /dev/null -w '%{http_code}\n' https://qcrm.qbadvisory.com/
```

### Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| **ChunkLoadError** | White screen flashing | Users: Ctrl+Shift+R. Devs: Rebuild + deploy frontend |
| **Build OOM** | Build hangs or crashes | `sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'` before build |
| **Port in use** | Frontend won't start | `fuser -k 3000/tcp` then `pm2 restart qcrm-frontend` |
| **Stale TypeScript** | Backend errors after code change | `npx tsc --skipLibCheck` then `pm2 restart qcrm-backend` |
| **DB connection** | Prisma connection errors | Check `DATABASE_URL` in `.env`, verify PostgreSQL running: `systemctl status postgresql` |
| **SSL expired** | HTTPS errors | `sudo certbot renew` |
| **PM2 not persisting** | Processes gone after reboot | `pm2 save && pm2 startup` |

### Log Files

| Log | Location |
|-----|----------|
| PM2 frontend | `~/.pm2/logs/qcrm-frontend-out.log` / `-error.log` |
| PM2 backend | `~/.pm2/logs/qcrm-backend-out.log` / `-error.log` |
| Nginx access | `/var/log/nginx/access.log` |
| Nginx error | `/var/log/nginx/error.log` |
| Next.js build | `/tmp/nextbuild.log` (when redirected) |
| PostgreSQL | `/var/log/postgresql/` |

---

## 11. SSL Certificate

| Property | Value |
|----------|-------|
| **Provider** | Let's Encrypt (Certbot) |
| **Domain** | qcrm.qbadvisory.com |
| **Cert Path** | `/etc/letsencrypt/live/qcrm.qbadvisory.com/fullchain.pem` |
| **Key Path** | `/etc/letsencrypt/live/qcrm.qbadvisory.com/privkey.pem` |
| **Auto-Renewal** | Certbot timer (systemd) |

```bash
# Check cert expiry
sudo certbot certificates

# Manual renewal
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 12. Backup & Recovery

### Database Backup

```bash
# Full backup
pg_dump -U postgres agentic_crm > /home/azureuser/backups/qcrm_$(date +%Y%m%d).sql

# Restore
psql -U postgres agentic_crm < /home/azureuser/backups/qcrm_20260514.sql
```

### Application Backup

```bash
# Code is in Git — ensure all changes are committed and pushed
cd /home/azureuser/app
git status
git add -A && git commit -m "backup" && git push origin Opportunity_MVC
```

### PM2 Process State

```bash
pm2 save                    # Saves current process list
pm2 resurrect               # Restores saved processes after reboot
```

---

## 13. Git Workflow (from Windows Workstation)

### Push to Both Remotes

```powershell
# Set environment for non-interactive auth
$env:GIT_TERMINAL_PROMPT=0
$env:GCM_INTERACTIVE="never"

cd d:\Opportunity\Jaydeep_work

# Stage and commit
git add -A
git commit -m "description of changes"

# Push to both remotes
git push qcrm Opportunity_MVC
git push origin Opportunity_MVC
```

### Deploy After Push (from VM)

```bash
cd /home/azureuser/app
git pull origin Opportunity_MVC

# Then follow Section 9 deployment procedures
```

---

## 14. Quick Reference Commands

```bash
# === Status ===
pm2 list                                    # All processes
pm2 logs --lines 20                         # Recent logs
df -h /                                     # Disk usage
free -h                                     # Memory usage

# === Restart ===
pm2 restart qcrm-frontend                   # Frontend only
pm2 restart qcrm-backend                    # Backend only
pm2 restart all                             # Everything
sudo systemctl reload nginx                 # Nginx config reload

# === Deploy Frontend ===
pm2 stop qcrm-frontend && fuser -k 3000/tcp 2>/dev/null
cd /home/azureuser/app/agentic-crm && rm -rf .next
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
NODE_OPTIONS='--max-old-space-size=3072' npx next build
pm2 restart qcrm-frontend

# === Deploy Backend ===
cd /home/azureuser/app/backend
npx tsc --skipLibCheck
pm2 restart qcrm-backend

# === Database ===
psql -U postgres -d agentic_crm
cd /home/azureuser/app/backend && npx prisma migrate deploy

# === Nginx ===
sudo nginx -t                               # Test config
sudo systemctl reload nginx                 # Apply changes
cat /etc/nginx/sites-enabled/qcrm           # View config
```
