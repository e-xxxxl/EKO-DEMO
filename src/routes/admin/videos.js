import { Router } from "express";
import Video from "../../models/Video.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Video.find().sort({ publishedAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, youtubeUrl, isActive, publishedAt } = req.body;
    const video = await Video.create({ title, youtubeUrl, isActive, publishedAt });
    res.status(201).json(video);
  } catch (err) {
    next(err);
  }
});

// Loaded and saved (not findByIdAndUpdate) so the schema's validate hook
// re-derives the video id whenever the link is changed.
router.put("/:id", async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    const { title, youtubeUrl, isActive, publishedAt } = req.body;
    if (title !== undefined) video.title = title;
    if (youtubeUrl !== undefined) video.youtubeUrl = youtubeUrl;
    if (isActive !== undefined) video.isActive = isActive;
    if (publishedAt !== undefined) video.publishedAt = publishedAt;
    await video.save();
    res.json(video);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
