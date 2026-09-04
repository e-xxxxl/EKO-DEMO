import { Router } from "express";
import ContactSubmission from "../models/ContactSubmission.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public write endpoint — stricter rate limit than general GET traffic since
// this is the one unauthenticated route that accepts arbitrary user input
// and is a natural spam target.
router.post("/", sensitiveLimiter, async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email and message are required" });
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    await ContactSubmission.create({
      name: String(name).slice(0, 120),
      email: String(email).slice(0, 200),
      message: String(message).slice(0, 2000),
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
