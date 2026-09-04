import { Router } from "express";
import ContactSubmission from "../../models/ContactSubmission.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await ContactSubmission.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

// Mark read/unread — the only mutation the signed scope calls for
// ("View contact form submissions"), so no create/delete routes here.
router.put("/:id", async (req, res, next) => {
  try {
    const submission = await ContactSubmission.findByIdAndUpdate(
      req.params.id,
      { read: Boolean(req.body.read) },
      { new: true, runValidators: true }
    );
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    res.json(submission);
  } catch (err) {
    next(err);
  }
});

export default router;
