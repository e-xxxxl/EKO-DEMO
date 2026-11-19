import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// How full the club's Cloudinary account is, read live from Cloudinary's own usage
// report. Super admin only.
router.use(requireAuth, requireRole("super_admin"));

const authHeader = () =>
  "Basic " + Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

router.get("/", async (_req, res, next) => {
  try {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ error: "Cloudinary is not configured on the server" });
    }

    let r;
    try {
      r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
        headers: { Authorization: authHeader() },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return res.status(502).json({ error: "Cloudinary did not respond in time. Try again in a moment." });
    }
    const u = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: u.error?.message || "Cloudinary did not respond" });

    // Cloudinary reports storage in bytes. Its plans are measured in "credits":
    // 1 credit covers 1 GB of storage, or 1 GB of delivery, or 1,000 transformations,
    // all drawn from one shared allowance. So the room left is shown as credits and,
    // where it can be worked out, as roughly how many GB of storage that could hold.
    const storageBytes = num(u.storage?.usage) ?? 0;
    const creditsUsed = num(u.credits?.usage);
    const creditsLimit = num(u.credits?.limit);
    const usedPercent = num(u.credits?.used_percent) ?? (creditsUsed !== null && creditsLimit ? (creditsUsed / creditsLimit) * 100 : null);

    res.json({
      plan: u.plan || null,
      lastUpdated: u.last_updated || null,
      storageBytes,
      photos: num(u.resources) ?? num(u.objects?.usage),
      creditsUsed,
      creditsLimit,
      creditsLeft: creditsUsed !== null && creditsLimit !== null ? Math.max(0, creditsLimit - creditsUsed) : null,
      usedPercent: usedPercent === null ? null : Math.round(usedPercent * 10) / 10,
      storageLimitBytes: creditsLimit !== null ? creditsLimit * 1024 ** 3 : null,
      bandwidthBytes: num(u.bandwidth?.usage),
      transformations: num(u.transformations?.usage),
      // Where the credits went, so the club can see what actually fills the plan.
      creditBreakdown: {
        storage: num(u.storage?.credits_usage) ?? 0,
        bandwidth: num(u.bandwidth?.credits_usage) ?? 0,
        transformations: num(u.transformations?.credits_usage) ?? 0,
      },
      largestImageBytes: num(u.media_limits?.image_max_size_bytes),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
