import rateLimit from "express-rate-limit";

// General public API traffic
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Checkout and the referral-code check: busy at a ticket release, and many
// fans share one mobile-network address, so this is looser than the
// sensitive limiter while still stopping scripted floods.
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
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
