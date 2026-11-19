import { Router } from "express";
import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";
import { requireAuth } from "../middleware/auth.js";
import { recordActivity } from "../middleware/activityLog.js";

const router = Router();

router.post("/login", sensitiveLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await AdminUser.findOne({ email: email.toLowerCase(), isActive: true });
    const where = {
      method: "POST",
      path: "/api/admin/auth/login",
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
    };
    // Deliberately vague error on both branches — don't reveal whether the email exists
    if (!user || !(await user.checkPassword(password))) {
      // The attempt is recorded for the super admin (the email that was tried, never the password).
      recordActivity({
        action: "login_failed",
        section: "Sign in",
        summary: user
          ? `Wrong password for ${user.name}`
          : `Sign in attempt with an unknown email (${String(email).slice(0, 80)})`,
        adminId: user?._id,
        adminName: user?.name,
        adminEmail: user?.email || String(email).toLowerCase().slice(0, 120),
        adminRole: user?.role,
        ...where,
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save();
    recordActivity({
      action: "login",
      section: "Sign in",
      summary: "Signed in",
      adminId: user._id,
      adminName: user.name,
      adminEmail: user.email,
      adminRole: user.role,
      ...where,
    });

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

// requireAuth loads the account fresh, so this always reflects the current name,
// email and role (including any change the super admin has just made).
router.get("/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

export default router;

// NOTE: creating new AdminUser records is deliberately not exposed as a public
// route. Seed the first super_admin via a one-off script, and let super_admins
// create further accounts through an admin-only, requireRole("super_admin") route.
