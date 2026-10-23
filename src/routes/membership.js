import { Router } from "express";
import MembershipApplication, { MEMBERSHIP_TIERS } from "../models/MembershipApplication.js";
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
    if (!MEMBERSHIP_TIERS[tier]) {
      return res.status(400).json({ error: "Choose a membership package" });
    }

    const application = await MembershipApplication.create({
      name: String(name).slice(0, 120),
      email: String(email).slice(0, 200),
      phone: String(phone).slice(0, 40),
      tier,
    });

    // Saved. Now tell the marketing team. A failure here must not lose or
    // reject the application (it is already stored and visible in admin).
    if (resend.isConfigured()) {
      try {
        const tierName = MEMBERSHIP_TIERS[tier];
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
