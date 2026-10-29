import { Router } from "express";
import Enquiry from "../models/Enquiry.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";
import { notifyMarketing } from "../services/email/notify.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/", sensitiveLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, institution, course, level, social, message } = req.body;
    if (!name || !email || !phone || !institution) {
      return res.status(400).json({ error: "Name, email, phone number and institution are required" });
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    if (String(phone).replace(/\D/g, "").length < 7) {
      return res.status(400).json({ error: "Enter a valid phone number" });
    }

    const details = {
      Institution: String(institution).slice(0, 160),
      "Course of study": String(course || "").slice(0, 160),
      Level: String(level || "").slice(0, 60),
      "Social media handle": String(social || "").slice(0, 120),
      Message: String(message || "").slice(0, 1500),
    };

    const enquiry = await Enquiry.create({
      type: "campus_ambassador",
      name: String(name).slice(0, 120),
      email: String(email).slice(0, 200),
      phone: String(phone).slice(0, 40),
      details,
    });

    const sent = await notifyMarketing({
      subject: `New campus ambassador application: ${name}`,
      heading: "New Campus Ambassador Application",
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
