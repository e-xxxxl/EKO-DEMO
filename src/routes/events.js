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

// Events the club has switched on for the homepage hero carousel. An event drops
// out the day after its date; one with no date stays until it is switched off.
router.get("/hero", async (_req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await Event.find({
      isActive: true,
      showInHero: true,
      $or: [{ eventDate: null }, { eventDate: { $exists: false } }, { eventDate: { $gte: cutoff } }],
    })
      .sort({ eventDate: 1, createdAt: -1 })
      .limit(3);
    res.json(events);
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
