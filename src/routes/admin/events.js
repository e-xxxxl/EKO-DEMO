import { Router } from "express";
import Event from "../../models/Event.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Event.find().sort({ eventDate: -1, createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

function fields(body) {
  const { name, slug, description, eventDate, location, imageUrl, images, isActive } = body;
  return {
    name,
    slug,
    description,
    eventDate: eventDate || null,
    location,
    imageUrl,
    images: Array.isArray(images) ? images.filter(Boolean) : [],
    isActive,
  };
}

router.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await Event.create(fields(req.body)));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, fields(req.body), { new: true, runValidators: true });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
