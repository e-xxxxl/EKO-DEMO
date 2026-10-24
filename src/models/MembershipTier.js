import mongoose from "mongoose";

// One membership package shown on /membership. Everything a visitor sees on
// its card is editable in the admin panel. `slug` is the stable id that
// applications refer to, so it never changes when a package is renamed.
const membershipTierSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    audience: { type: String, trim: true, maxlength: 80 }, // e.g. "For individuals"
    price: { type: String, required: true, trim: true, maxlength: 40 }, // shown as typed, e.g. "₦5,000,000"
    period: { type: String, trim: true, maxlength: 40 }, // e.g. "per year"; empty for a one-off fee
    tagline: { type: String, trim: true, maxlength: 200 }, // one-line pitch under the name
    badge: { type: String, trim: true, maxlength: 30 }, // optional ribbon, e.g. "Most exclusive"
    imageUrl: { type: String, trim: true },
    perks: [{ type: String, trim: true, maxlength: 300 }],
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

membershipTierSchema.index({ displayOrder: 1 });

export default mongoose.model("MembershipTier", membershipTierSchema);
