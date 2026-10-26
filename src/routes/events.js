import { Router } from "express";
import Event from "../models/Event.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Event.find({ isActive: true }).sort({ eventDate: -1, createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug, isActive: true });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

export default router;
