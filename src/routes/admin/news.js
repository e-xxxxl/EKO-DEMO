import { Router } from "express";
import News from "../../models/News.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await News.find().sort({ publishedAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // req.body.coverImageUrl should already be a Cloudinary secure_url obtained
    // via POST /api/admin/upload/signature from the admin panel's upload form
    const article = await News.create(req.body);
    res.status(201).json(article);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const article = await News.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const article = await News.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
