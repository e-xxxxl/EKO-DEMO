import { Router } from "express";
import PagePhotos, { PAGE_PHOTO_KEYS } from "../../models/PagePhotos.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    const docs = await PagePhotos.find();
    res.json(Object.fromEntries(docs.map((d) => [d.key, d.images])));
  } catch (err) {
    next(err);
  }
});

router.put("/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!PAGE_PHOTO_KEYS.includes(key)) return res.status(404).json({ error: "Unknown page" });
    const images = Array.isArray(req.body.images) ? req.body.images.filter(Boolean).slice(0, 3) : [];
    const doc = await PagePhotos.findOneAndUpdate(
      { key },
      { key, images },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

export default router;
