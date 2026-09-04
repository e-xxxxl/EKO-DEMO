import { Router } from "express";
import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", sensitiveLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await AdminUser.findOne({ email: email.toLowerCase(), isActive: true });
    // Deliberately vague error on both branches — don't reveal whether the email exists
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

export default router;

// NOTE: creating new AdminUser records is deliberately not exposed as a public
// route. Seed the first super_admin via a one-off script, and let super_admins
// create further accounts through an admin-only, requireRole("super_admin") route.
