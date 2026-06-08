// Ensures modules that read secrets at import time (e.g. auth.service) can load
// during tests. Runs before any test module via jest `setupFiles`.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-please-ignore';
