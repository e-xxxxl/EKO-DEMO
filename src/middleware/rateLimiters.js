import rateLimit from "express-rate-limit";

// General public API traffic
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for anything auth/checkout/payment related — wire this
// into /api/admin/login, /api/checkout, etc. in Phase 2
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
