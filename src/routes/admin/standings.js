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
    const standing = await Standing.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!standing) return res.status(404).json({ error: "Standing not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
