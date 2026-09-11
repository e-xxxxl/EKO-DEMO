import { Router } from "express";
import GalleryItem from "../../models/GalleryItem.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await GalleryItem.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // req.body.url should already be a Cloudinary secure_url obtained via
    // POST /api/admin/upload/signature from the admin panel's upload form
    const item = await GalleryItem.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const item = await GalleryItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: "Gallery item not found" });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const item = await GalleryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Gallery item not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
