import { Router } from "express";
import Standing from "../../models/Standing.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (req, res, next) => {
  try {
    const season = req.query.season || "2026";
    res.json(await Standing.find({ season }).sort({ position: 1 }));
  } catch (err) {
    next(err);
  }
});

const whole = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

// Saves the whole table in one go, the way the admin Table screen works: every
// row is created or updated, and any club left out of the list is removed. A
// row that arrives without an _id is a new club. Positions are taken from the
// order of the list, so the order on screen is the order on the site.
router.put("/", async (req, res, next) => {
  try {
    const season = String(req.body.season || "2026");
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.some((r) => !String(r.clubName || "").trim())) {
      return res.status(400).json({ error: "Every club needs a name" });
    }
    const names = rows.map((r) => String(r.clubName).trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      return res.status(400).json({ error: "The same club is in the table twice" });
    }

    const clean = (r, i) => ({
      clubName: String(r.clubName).trim(),
      clubLogoUrl: r.clubLogoUrl ? String(r.clubLogoUrl).trim() : undefined,
      isEkoUnited: Boolean(r.isEkoUnited),
      played: whole(r.played),
      won: whole(r.won),
      drawn: whole(r.drawn),
      lost: whole(r.lost),
      goalsFor: whole(r.goalsFor),
      goalsAgainst: whole(r.goalsAgainst),
      points: whole(r.points),
      form: (Array.isArray(r.form) ? r.form : []).filter((x) => ["W", "D", "L"].includes(x)).slice(-5),
      isActive: r.isActive !== false,
      position: i + 1,
      season,
    });

    const keep = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const data = clean(r, i);
      if (r._id) {
        keep.add(String(r._id));
        await Standing.findOneAndUpdate({ _id: r._id, season }, data, { runValidators: true });
      } else {
        const created = await Standing.create(data);
        keep.add(String(created._id));
      }
    }
    // Clubs taken out of the table on screen are removed.
    const existing = await Standing.find({ season }).select("_id");
    const gone = existing.filter((s) => !keep.has(String(s._id))).map((s) => s._id);
    if (gone.length > 0) await Standing.deleteMany({ _id: { $in: gone } });

    res.json(await Standing.find({ season }).sort({ position: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // req.body.clubLogoUrl should already be a Cloudinary secure_url obtained
    // via POST /api/admin/upload/signature from the admin panel's upload form
    const standing = await Standing.create(req.body);
    res.status(201).json(standing);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const standing = await Standing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!standing) return res.status(404).json({ error: "Standing not found" });
    res.json(standing);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const standing = await Standing.findByIdAndDelete(req.params.id);
    if (!standing) return res.status(404).json({ error: "Standing not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
