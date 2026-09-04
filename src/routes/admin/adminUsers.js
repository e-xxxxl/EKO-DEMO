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
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "An account with that email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await AdminUser.create({ name, email, passwordHash, role });
    const { passwordHash: _omit, ...safe } = user.toObject();
    res.status(201).json(safe);
  } catch (err) {
    next(err);
  }
});

// Name/role/isActive only — password resets go through PUT /:id/password
// below, kept separate so a routine "change this person's role" call can't
// accidentally also touch their password.
router.put("/:id", async (req, res, next) => {
  try {
    if (req.params.id === req.admin.sub && req.body.isActive === false) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }
    const { name, role, isActive } = req.body;
    const user = await AdminUser.findByIdAndUpdate(
      req.params.id,
      { ...(name && { name }), ...(role && { role }), ...(isActive !== undefined && { isActive }) },
      { new: true, runValidators: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Account not found" });
    res.json(user);
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
