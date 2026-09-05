import { Router } from "express";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";
import resend from "../services/email/resend.js";

const router = Router();

const TO_EMAIL = "Ekounitedfc01@gmail.com";

// Escapes user-supplied text before it goes into an HTML email body — this
// is the one place on the public site where a visitor's raw input is
// embedded directly into HTML that gets sent/rendered elsewhere (an inbox),
// so it needs the same treatment as any other untrusted-input-into-HTML spot.
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
    const { name, email, phone, outlet, role, matchInterest, message } = req.body;
    if (!name || !email || !outlet || !message) {
      return res.status(400).json({ error: "Name, email, outlet and message are required" });
    }

    if (!resend.isConfigured()) {
      // Never silently pretend this was sent — tell the truth so a real
      // request doesn't quietly vanish before RESEND_API_KEY is set.
      return res.status(503).json({
        error:
          "Media accreditation requests can't be emailed automatically yet — please contact the club directly in the meantime.",
      });
    }

    const html = `
      <h2>New Media Accreditation Request</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
      <p><strong>Outlet / Organisation:</strong> ${escapeHtml(outlet)}</p>
      <p><strong>Role:</strong> ${escapeHtml(role || "—")}</p>
      <p><strong>Match(es) interested in:</strong> ${escapeHtml(matchInterest || "—")}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
    `;

    await resend.sendEmail({
      to: TO_EMAIL,
      subject: `Media Accreditation Request — ${name} (${outlet})`,
      html,
      replyTo: email,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
