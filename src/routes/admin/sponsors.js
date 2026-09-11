import { Router } from "express";
import Sponsor from "../../models/Sponsor.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Sponsor.find().sort({ tier: 1, displayOrder: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // req.body.logoUrl should already be a Cloudinary secure_url obtained via
    // POST /api/admin/upload/signature from the admin panel's upload form
    const sponsor = await Sponsor.create(req.body);
    res.status(201).json(sponsor);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!sponsor) return res.status(404).json({ error: "Sponsor not found" });
    res.json(sponsor);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findByIdAndDelete(req.params.id);
    if (!sponsor) return res.status(404).json({ error: "Sponsor not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
