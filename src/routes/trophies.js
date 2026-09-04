import { Router } from "express";
import Trophy from "../models/Trophy.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Trophy.find({ isActive: true }).sort({ year: -1, displayOrder: 1 }));
  } catch (err) {
    next(err);
  }
});

export default router;
