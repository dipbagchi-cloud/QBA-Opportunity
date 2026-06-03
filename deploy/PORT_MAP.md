# Q-CRM port map — single source of truth

The three environments run side-by-side on one VM. The login flow is Microsoft
SSO, and SSO breaks the instant any of these mappings disagree, because the
OAuth round-trip makes **two** backend calls (`/api/auth/sso/url` to start,
`/api/auth/sso/callback` to finish). If those two calls land on different
backends — e.g. nginx `/api` pointed at the wrong port — Microsoft returns
`AADSTS500112: reply address ... does not match`.

**Every value in this table must agree across: the backend `.env` `PORT`, the
nginx `/api` `proxy_pass`, and the port argument in `.github/workflows/deploy.yml`.**

| Env  | Host                      | Frontend (`/`) | Backend (`/api`, `/uploads`) | `AZURE_AD_REDIRECT_URI`            |
|------|---------------------------|----------------|------------------------------|------------------------------------|
| prod | `qcrm.qbadvisory.com`     | **3000**       | **3001**                     | `https://qcrm.qbadvisory.com/login`     |
| UAT  | `uat-qcrm.qbadvisory.com` | **3002**       | **3005**                     | `https://uat-qcrm.qbadvisory.com/login` |
| QA   | `qa-qcrm.qbadvisory.com`  | **3004**       | **3003**                     | `https://qa-qcrm.qbadvisory.com/login`  |

Note the backend ports are intentionally **not** in numeric order with the
frontends: UAT backend is 3005, QA backend is 3003. This is the exact pair that
has been swapped before (in both nginx and `deploy.yml`), taking SSO down on
both QA and UAT at once. Do not "tidy" them into sequence.

- All three share ONE Entra app: same tenant / client id / client secret. Only
  `AZURE_AD_REDIRECT_URI` differs per host. See the `sso-config-across-envs`
  note for the full SSO wiring and AADSTS troubleshooting.
- Canonical nginx server blocks live in [`nginx/`](./nginx) next to this file.
  They are the reference copy of `/etc/nginx/sites-available/{qcrm,qcrm-qa,qcrm-uat}`
  on the VM. nginx is **not** auto-deployed by CI, so if you change routing on
  the VM, update these files too.

## Verify routing after any deploy or nginx change

From the VM (curl over the public HTTPS name gets OOM-killed there, so this hits
the loopback with an SNI/Host header instead):

```bash
node scripts/verify-sso-routing.js
```

Exits non-zero and prints `FAIL` for any host whose `/api/auth/sso/url` does not
return a `redirect_uri` matching its own host — which is exactly the symptom of a
swapped `/api` upstream.
