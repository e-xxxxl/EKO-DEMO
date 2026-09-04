import { Router } from "express";
import GalleryItem from "../models/GalleryItem.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true, ...(type ? { type } : {}) };
    const items = await GalleryItem.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

export default router;
