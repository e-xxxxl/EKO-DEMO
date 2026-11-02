import mongoose from "mongoose";

// A referral code is tied to a person (an ambassador, a partner, a staff
// member). Shoppers and ticket buyers can enter it at checkout. It can give a
// percentage discount, or just track who brought the sale in (0 percent). Each
// order keeps a snapshot of the code and owner it used, so the numbers on the
// admin Referral codes page stay right even if a code is later edited or
// deleted.
const referralCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{3,24}$/, "Use 3 to 24 letters, numbers, dashes or underscores"],
    },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 }, // 0 means track only
    appliesTo: { type: String, enum: ["both", "shop", "tickets"], default: "both" },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

export function normalizeReferralCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

// Does this code work for an order of the given kind ("shop" or "ticket")?
export function referralAppliesTo(referral, orderType) {
  return referral.appliesTo === "both" || (orderType === "shop" ? referral.appliesTo === "shop" : referral.appliesTo === "tickets");
}

export default mongoose.model("ReferralCode", referralCodeSchema);
