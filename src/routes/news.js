import { Router } from "express";
import News from "../models/News.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const filter = { isActive: true, ...(req.query.category ? { category: req.query.category } : {}) };
    const news = await News.find(filter).sort({ publishedAt: -1 }).limit(limit);
    res.json(news);
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const article = await News.findOne({ slug: req.params.slug, isActive: true });
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (err) {
    next(err);
  }
});

export default router;
