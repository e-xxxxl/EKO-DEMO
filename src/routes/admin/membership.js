import { Router } from "express";
import MembershipApplication from "../../models/MembershipApplication.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await MembershipApplication.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

// Mark handled/unhandled (read), the same single mutation the contact inbox has.
router.put("/:id", async (req, res, next) => {
  try {
    const application = await MembershipApplication.findByIdAndUpdate(
      req.params.id,
      { read: Boolean(req.body.read) },
      { new: true }
    );
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json(application);
  } catch (err) {
    next(err);
  }
});

export default router;
