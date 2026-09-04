import { Router } from "express";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

/**
 * Direct-to-cloud uploads: the browser (admin panel) uploads the image file
 * straight to Cloudinary using a short-lived signature from this endpoint —
 * the image bytes never touch the VPS. Used for player photos, news cover
 * images, gallery, sponsor logos, club/standing logos.
 *
 * Frontend flow:
 *  1. POST /api/admin/upload/signature  (auth'd) -> { signature, timestamp, apiKey, cloudName, folder }
 *  2. POST directly to https://api.cloudinary.com/v1_1/{cloudName}/image/upload
 *     with the file + those fields
 *  3. Save the returned secure_url on the relevant document (Player.photoUrl, etc.)
 */
router.post(
  "/signature",
  requireAuth,
  requireRole("content_editor", "shop_manager"),
  (req, res) => {
    const { folder = "eko-united-fc" } = req.body;
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign = { timestamp, folder };
    const sortedParams = Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join("&");

    const signature = crypto
      .createHash("sha1")
      .update(sortedParams + process.env.CLOUDINARY_API_SECRET)
      .digest("hex");

    res.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  }
);

export default router;
