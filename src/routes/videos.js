import { Router } from "express";
import Video from "../models/Video.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 60, 100);
    res.json(await Video.find({ isActive: true }).sort({ publishedAt: -1 }).limit(limit));
  } catch (err) {
    next(err);
  }
});

export default router;
