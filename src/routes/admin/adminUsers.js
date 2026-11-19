import { Router } from "express";
import bcrypt from "bcryptjs";
import AdminUser from "../../models/AdminUser.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// Staff account management — super_admin only, per CLAUDE.md §5 ("super_admin:
// everything, including creating/managing other admin users"). The public
// login/me endpoints live in routes/adminAuth.js; this is the counterpart
// referenced in that file's own comment ("let super_admins create further
// accounts through an admin-only, requireRole('super_admin') route").
router.use(requireAuth, requireRole("super_admin"));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/", async (_req, res, next) => {
  try {
    res.json(await AdminUser.find().select("-passwordHash").sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Name, email, password and role are required" });
    }
    if (!EMAIL.test(String(email).trim())) {
      return res.status(400).json({ error: "That email address doesn't look right" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const existing = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: "An account with that email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await AdminUser.create({ name, email, passwordHash, role });
    const { passwordHash: _omit, ...safe } = user.toObject();
    res.status(201).json(safe);
  } catch (err) {
    next(err);
  }
});

// Name, email, role and active/inactive. Password resets go through
// PUT /:id/password below, kept separate so a routine "change this person's
// details" call can't accidentally also touch their password.
router.put("/:id", async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Account not found" });

    const { name, email, role, isActive } = req.body;
    const isSelf = req.params.id === req.admin.sub;

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: "Name can't be empty" });
      user.name = String(name).trim();
    }

    if (email !== undefined) {
      const clean = String(email).toLowerCase().trim();
      if (!EMAIL.test(clean)) return res.status(400).json({ error: "That email address doesn't look right" });
      if (clean !== user.email) {
        const taken = await AdminUser.findOne({ email: clean, _id: { $ne: user._id } });
        if (taken) return res.status(409).json({ error: "Another account already uses that email" });
        user.email = clean;
      }
    }

    // Never let the club lock itself out: there must always be at least one active
    // super admin, and you can't remove your own access.
    const losesSuperAdmin =
      user.role === "super_admin" &&
      user.isActive &&
      ((role !== undefined && role !== "super_admin") || isActive === false);
    if (losesSuperAdmin) {
      if (isSelf) return res.status(400).json({ error: "You can't remove your own super admin access or deactivate yourself" });
      const others = await AdminUser.countDocuments({ role: "super_admin", isActive: true, _id: { $ne: user._id } });
      if (others === 0) return res.status(400).json({ error: "There must always be at least one active super admin" });
    }
    if (isSelf && isActive === false) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }

    if (role !== undefined) {
      if (!AdminUser.ROLES.includes(role)) return res.status(400).json({ error: "Unknown role" });
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();
    const { passwordHash: _omit, ...safe } = user.toObject();
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/password", async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await AdminUser.findByIdAndUpdate(
      req.params.id,
      { passwordHash },
      { new: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Account not found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
