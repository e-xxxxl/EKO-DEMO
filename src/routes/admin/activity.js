import { Router } from "express";
import mongoose from "mongoose";
import ActivityLog from "../../models/ActivityLog.js";
import AdminUser from "../../models/AdminUser.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// Who did what, and when. Super admin only: staff can't see (or be tempted to
// edit) the record of their own actions, and nothing here can change or delete
// a row; the log is read-only by design.
router.use(requireAuth, requireRole("super_admin"));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/activity?staff=<id>&action=&section=&from=YYYY-MM-DD&to=YYYY-MM-DD&q=&page=1&limit=40
router.get("/", async (req, res, next) => {
  try {
    const { staff, action, section, from, to, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));

    const filter = {};
    if (staff && mongoose.isValidObjectId(staff)) filter.adminId = staff;
    if (action && typeof action === "string") filter.action = action;
    if (section && typeof section === "string") filter.section = section;
    if (from || to) {
      filter.createdAt = {};
      // Dates are read as Lagos days (UTC+1), so "today" means the club's today.
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00+01:00`);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999+01:00`);
    }
    if (q && typeof q === "string" && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim().slice(0, 80)), "i");
      filter.$or = [{ summary: rx }, { adminName: rx }, { section: rx }];
    }

    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/activity/staff : one card per staff account with their last
// sign in, how much they did in the last 30 days, and what they did last.
router.get("/staff", async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [users, counts, lastActions] = await Promise.all([
      AdminUser.find().select("name email role isActive lastLoginAt").lean(),
      ActivityLog.aggregate([
        { $match: { createdAt: { $gte: since }, action: { $nin: ["login", "login_failed"] } } },
        { $group: { _id: "$adminId", changes: { $sum: 1 } } },
      ]),
      ActivityLog.aggregate([
        { $match: { action: { $nin: ["login", "login_failed"] } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$adminId", summary: { $first: "$summary" }, at: { $first: "$createdAt" } } },
      ]),
    ]);
    const changes = new Map(counts.map((c) => [String(c._id), c.changes]));
    const last = new Map(lastActions.map((l) => [String(l._id), l]));

    const failed = await ActivityLog.countDocuments({ action: "login_failed", createdAt: { $gte: since } });

    res.json({
      failedSignIns30d: failed,
      staff: users
        .map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt || null,
          changes30d: changes.get(String(u._id)) || 0,
          lastAction: last.get(String(u._id))?.summary || null,
          lastActionAt: last.get(String(u._id))?.at || null,
        }))
        .sort((a, b) => b.changes30d - a.changes30d),
    });
  } catch (err) {
    next(err);
  }
});

// The sections that appear in the log, for the filter menu.
router.get("/sections", async (_req, res, next) => {
  try {
    const sections = await ActivityLog.distinct("section");
    res.json(sections.filter(Boolean).sort());
  } catch (err) {
    next(err);
  }
});

export default router;
