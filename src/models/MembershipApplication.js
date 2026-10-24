import mongoose from "mongoose";

// Every membership enquiry is saved here first, then emailed to the club's
// marketing team. Saving first means an application is never lost if email
// is down or not configured yet; it always shows up in the admin panel.
const membershipApplicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    tier: { type: String, required: true, trim: true }, // MembershipTier slug
    tierName: { type: String, trim: true }, // the package name at the time they applied
    emailed: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

membershipApplicationSchema.index({ createdAt: -1 });

export default mongoose.model("MembershipApplication", membershipApplicationSchema);
