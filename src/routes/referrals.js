import { Router } from "express";
import ReferralCode, { normalizeReferralCode, referralAppliesTo } from "../models/ReferralCode.js";
import { checkoutLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// Lets the cart check a code before the buyer pays, so they can see the
// discount. It says only whether the code works and how much it takes off;
// the name the code belongs to is never sent to the public site. Checkout
// looks the code up again on its own, so this is a convenience, not the
// authority.
router.get("/check", checkoutLimiter, async (req, res, next) => {
  try {
    const code = normalizeReferralCode(req.query.code);
    const type = req.query.type === "ticket" ? "ticket" : "shop";
    if (!code) return res.status(400).json({ valid: false, error: "Enter a referral code" });

    const referral = await ReferralCode.findOne({ code, isActive: true });
    if (!referral || !referralAppliesTo(referral, type)) {
      return res.status(404).json({ valid: false, error: "That referral code isn't valid" });
    }
    res.json({ valid: true, code: referral.code, discountPercent: referral.discountPercent });
  } catch (err) {
    next(err);
  }
});

export default router;
