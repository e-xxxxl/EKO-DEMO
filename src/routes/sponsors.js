import { Router } from "express";
import Sponsor from "../models/Sponsor.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const sponsors = await Sponsor.find({ isActive: true }).sort({ tier: 1, displayOrder: 1 });
    res.json(sponsors);
  } catch (err) {
    next(err);
  }
});

export default router;
