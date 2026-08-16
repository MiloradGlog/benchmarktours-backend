import rateLimit from 'express-rate-limit';

/**
 * Rate limiters for unauthenticated / abuse-prone endpoints.
 *
 * Railway terminates TLS at its edge and forwards over a proxy, so the app
 * must trust the proxy (see `app.set('trust proxy', 1)` in index.ts) for the
 * client IP used as the limiter key to be meaningful. Standard draft-7
 * `RateLimit-*` headers are returned; legacy `X-RateLimit-*` are disabled.
 */

const isProd = process.env.NODE_ENV === 'production';

// Credential-guessing surfaces: login, account setup, password reset.
// Tight window so brute-forcing a password or an 8-char setup code is
// infeasible, but a real user fat-fingering their password a few times is fine.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: isProd ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Account-deletion request (unauthenticated) and other low-frequency
// unauthenticated writes — a looser cap to stop scripted floods.
export const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: isProd ? 5 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Public survey endpoints: unauthenticated PII collection. Allow legitimate
// respondents (view + save-progress + submit) but throttle enumeration/floods.
export const publicSurveyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: isProd ? 30 : 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
