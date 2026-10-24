import mongoose from "mongoose";

// The words and pictures around the packages on /membership (a single
// document, edited in the admin panel under Membership, Page content).
const membershipContentSchema = new mongoose.Schema(
  {
    key: { type: String, default: "membership", unique: true },
    eyebrow: { type: String, trim: true, maxlength: 60 },
    title: { type: String, trim: true, maxlength: 120 },
    intro: { type: String, trim: true, maxlength: 600 },
    heroImageUrl: { type: String, trim: true },
    galleryHeading: { type: String, trim: true, maxlength: 80 },
    gallery: [
      {
        _id: false,
        url: { type: String, trim: true },
        caption: { type: String, trim: true, maxlength: 120 },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("MembershipContent", membershipContentSchema);
