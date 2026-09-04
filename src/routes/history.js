import { Router } from "express";
import HistoryMilestone from "../models/HistoryMilestone.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    res.json(await HistoryMilestone.find({ isActive: true }).sort({ year: 1 }));
  } catch (err) {
    next(err);
  }
});

export default router;
