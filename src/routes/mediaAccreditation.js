import { Router } from "express";
import Enquiry from "../models/Enquiry.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";
import { notifyMarketing } from "../services/email/notify.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Saved first, then emailed to the marketing team (see services/email/notify.js).
// Before this, a request was only emailed, so with no email key set it was
// rejected outright; now it is always kept and shows in the admin inbox.
router.post("/", sensitiveLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, outlet, role, matchInterest, message } = req.body;
    if (!name || !email || !outlet || !message) {
      return res.status(400).json({ error: "Name, email, outlet and message are required" });
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    const details = {
      "Outlet / Organisation": String(outlet).slice(0, 160),
      Role: String(role || "").slice(0, 120),
      "Match(es) interested in": String(matchInterest || "").slice(0, 200),
      Message: String(message).slice(0, 2000),
    };

    const enquiry = await Enquiry.create({
      type: "media",
      name: String(name).slice(0, 120),
      email: String(email).slice(0, 200),
      phone: String(phone || "").slice(0, 40),
      details,
    });

    const sent = await notifyMarketing({
      subject: `Media accreditation request: ${name} (${outlet})`,
      heading: "New Media Accreditation Request",
      rows: [["Name", name], ["Email", email], ["Phone", phone], ...Object.entries(details)],
      replyTo: String(email).trim(),
    });
    if (sent) {
      enquiry.emailed = true;
      await enquiry.save();
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
