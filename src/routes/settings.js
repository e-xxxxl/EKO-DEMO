import { Router } from "express";
import SiteSettings from "../models/SiteSettings.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const settings = await SiteSettings.findOne();
    res.json(settings || {});
  } catch (err) {
    next(err);
  }
});

export default router;
