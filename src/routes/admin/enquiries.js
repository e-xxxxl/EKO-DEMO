import { Router } from "express";
import Enquiry from "../../models/Enquiry.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Enquiry.find().sort({ createdAt: -1 }).limit(500));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { read: Boolean(req.body.read) }, { new: true });
    if (!enquiry) return res.status(404).json({ error: "Enquiry not found" });
    res.json(enquiry);
  } catch (err) {
    next(err);
  }
});

export default router;
