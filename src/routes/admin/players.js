import { Router } from "express";
import Player from "../../models/Player.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// Everything below requires a valid admin token, and only super_admin or
// content_editor may use it — this is THE reference pattern for building out
// the remaining admin CRUD (matches, news, gallery, sponsors, standings,
// settings) in the same style. Copy this file's shape for each.
router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Player.find().sort({ squadNumber: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // req.body.photoUrl should already be a Cloudinary secure_url obtained
    // via POST /api/admin/upload/signature from the admin panel's upload form
    const player = await Player.create(req.body);
    res.status(201).json(player);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
