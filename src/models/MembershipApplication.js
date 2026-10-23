import mongoose from "mongoose";

export const MEMBERSHIP_TIERS = {
  platinum_corporate: "Platinum Corporate",
  platinum_member: "Platinum Member",
  diamond_member: "Diamond Member",
  gold_member: "Gold Member",
};

// Every membership enquiry is saved here first, then emailed to the club's
// marketing team. Saving first means an application is never lost if email
// is down or not configured yet; it always shows up in the admin panel.
const membershipApplicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    tier: { type: String, required: true, enum: Object.keys(MEMBERSHIP_TIERS) },
    emailed: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

membershipApplicationSchema.index({ createdAt: -1 });

export default mongoose.model("MembershipApplication", membershipApplicationSchema);
