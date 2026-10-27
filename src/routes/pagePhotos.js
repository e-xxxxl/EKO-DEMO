import { Router } from "express";
import PagePhotos from "../models/PagePhotos.js";

const router = Router();

// { "media-accreditation": ["https://...", ...], ... } for every page that
// has photos set. Pages with none fall back to the site's default photos.
router.get("/", async (_req, res, next) => {
  try {
    const docs = await PagePhotos.find();
    res.json(Object.fromEntries(docs.map((d) => [d.key, d.images])));
  } catch (err) {
    next(err);
  }
});

export default router;
