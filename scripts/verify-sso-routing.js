#!/usr/bin/env node
/*
 * Verify that each environment's nginx `/api` routes to its OWN backend, by
 * asking each host for its SSO authorize URL and checking that the embedded
 * redirect_uri points back at the same host.
 *
 * Why: the SSO OAuth flow makes two backend calls (/sso/url then /sso/callback).
 * If nginx `/api` for qa-qcrm and uat-qcrm get swapped (a recurring mistake),
 * the two calls hit different backends and Microsoft rejects the login with
 * AADSTS500112. This catches that class of misconfiguration immediately.
 *
 * Runs against the loopback with an SNI + Host header, because curl/HTTPS to the
 * public domain gets OOM-killed on the VM. Exits non-zero if any host fails, so
 * it can gate a deploy.
 *
 * Usage:  node scripts/verify-sso-routing.js
 */
const https = require('https');

const HOSTS = [
  'qcrm.qbadvisory.com',
  'qa-qcrm.qbadvisory.com',
  'uat-qcrm.qbadvisory.com',
];

function check(host) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port: 443,
        servername: host, // SNI so nginx picks the right server block
        path: '/api/auth/sso/url',
        method: 'GET',
        headers: { Host: host },
        rejectUnauthorized: false, // loopback cert won't match 127.0.0.1
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const expected = `https://${host}/login`;
          let actual;
          try {
            const url = JSON.parse(body).url || '';
            const m = url.match(/redirect_uri=([^&]*)/);
            actual = m ? decodeURIComponent(m[1]) : null;
          } catch {
            actual = null;
          }
          const ok = actual === expected;
          console.log(
            `${ok ? 'PASS' : 'FAIL'}  ${host}  redirect_uri => ${
              actual || `(status ${res.statusCode}, body: ${body.slice(0, 120)})`
            }`
          );
          resolve(ok);
        });
      }
    );
    req.on('error', (e) => {
      console.log(`FAIL  ${host}  request error: ${e.message}`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.log(`FAIL  ${host}  timeout`);
      resolve(false);
    });
    req.end();
  });
}

(async () => {
  const results = await Promise.all(HOSTS.map(check));
  if (results.some((ok) => !ok)) {
    console.error('\nSSO routing verification FAILED — see deploy/PORT_MAP.md');
    process.exit(1);
  }
  console.log('\nAll SSO routes OK.');
})();
