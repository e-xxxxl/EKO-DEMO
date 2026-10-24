import { Router } from "express";
import MembershipApplication from "../models/MembershipApplication.js";
import MembershipTier from "../models/MembershipTier.js";
import { ensureTiers, getContent } from "../services/membershipDefaults.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";
import resend from "../services/email/resend.js";

const router = Router();

const toEmail = () => process.env.MEMBERSHIP_TO_EMAIL || "marketing&media@ekounitedfc.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Visitor input goes into an HTML email body, so it is escaped first.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Everything the /membership page shows: the page copy and pictures plus the
// active packages in display order. Seeds the club's starting packages the
// first time it is asked for.
router.get("/plans", async (_req, res, next) => {
  try {
    await ensureTiers();
    const [content, tiers] = await Promise.all([
      getContent(),
      MembershipTier.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 }),
    ]);
    res.json({ content, tiers });
  } catch (err) {
    next(err);
  }
});

router.post("/", sensitiveLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, tier } = req.body;
    if (!name || !email || !phone || !tier) {
      return res.status(400).json({ error: "Name, email, phone number and package are required" });
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    if (String(phone).replace(/\D/g, "").length < 7) {
      return res.status(400).json({ error: "Enter a valid phone number" });
    }
    const chosen = typeof tier === "string" ? await MembershipTier.findOne({ slug: tier, isActive: true }) : null;
    if (!chosen) {
      return res.status(400).json({ error: "Choose a membership package" });
    }

    const application = await MembershipApplication.create({
      name: String(name).slice(0, 120),
      email: String(email).slice(0, 200),
      phone: String(phone).slice(0, 40),
      tier: chosen.slug,
      tierName: chosen.name,
    });

    // Saved. Now tell the marketing team. A failure here must not lose or
    // reject the application (it is already stored and visible in admin).
    if (resend.isConfigured()) {
      try {
        const tierName = chosen.name;
        await resend.sendEmail({
          to: toEmail(),
          subject: `New membership application: ${tierName} (${name})`,
          html: `
            <h2>New Club Membership Application</h2>
            <p><strong>Package:</strong> ${escapeHtml(tierName)}</p>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          `,
          replyTo: String(email).trim(),
        });
        application.emailed = true;
        await application.save();
      } catch (mailErr) {
        console.error("Membership email failed (application is saved):", mailErr.message);
      }
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
