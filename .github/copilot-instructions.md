# Copilot Instructions for Q-CRM Project

## Project Structure
- **Frontend:** `agentic-crm/` — Next.js 15 (App Router), port 3000
- **Backend:** `backend/` — Express + TypeScript, compiled to `dist/`, port 3001
- **Mobile:** `q-crm-mobile/` — React Native (Expo)
- **Database:** PostgreSQL + Prisma ORM

## Production Server
- **VM:** azureuser@20.124.178.41 (Ubuntu 22.04, Standard_B2ms, 2 vCPU / 8GB RAM)
- **PM2 services:** qcrm-backend (id 0), qcrm-frontend (id 1)
- **Domain:** https://qcrm.qbadvisory.com

## Deployment Rules — MUST FOLLOW

### Frontend Deployment
1. Upload changed source files via `Get-Content <file> | ssh azureuser@20.124.178.41 "cat > <remote-path>"`
2. SCP does NOT work on this VM — never attempt `scp`, use piped SSH instead.
3. Stop PM2 before building: `pm2 stop all`
4. Free memory: `sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'`
5. Build in background via nohup (SSH timeout kills foreground builds):
   ```
   ssh ... "cd /home/azureuser/app/agentic-crm && NODE_OPTIONS='--max-old-space-size=3072' nohup npx next build > /tmp/nextbuild.log 2>&1 &"
   ```
6. Monitor with `tail /tmp/nextbuild.log` and `ps aux | grep next`
7. Build takes ~5-7 minutes. Do NOT assume failure — check process list.
8. After build completes: `pm2 restart all && pm2 status`
9. NEVER build locally and upload .next folder — chunk hashes differ cross-platform.

### Backend Deployment
1. Upload .ts files, then run `npx tsc` on server
2. Restart: `pm2 restart qcrm-backend`

## Code Change Rules — MUST FOLLOW

### React State vs Ref for Guards
- **NEVER** use `useState` for one-time execution guards in useEffect.
- If you initialize `useState(someCondition)` to `true`, a `useEffect` that checks `if (!stateVar)` will NEVER fire.
- **ALWAYS** use `useRef(false)` for preventing double-execution of callbacks (OAuth, SSO, etc.).
- Pattern: `const guard = useRef(false); useEffect(() => { if (guard.current) return; guard.current = true; /* work */ }, []);`

### Before Deploying Any Fix
1. **Trace the full codepath mentally** — verify the fix doesn't break the next step.
2. When fixing bug A, check that bug B isn't introduced (e.g., fixing flash but breaking callback).
3. Test locally if possible before shipping to production.

## Environment
- Frontend env: `NEXT_PUBLIC_API_URL=https://qcrm.qbadvisory.com` (baked at build time)
- Backend env: `/home/azureuser/app/backend/.env`
- Auth: Azure AD SSO + local login (hybrid mode)
