import mongoose from "mongoose";

// Volunteer applications and media accreditation requests. Each is saved here
// first and then emailed to the club's marketing team, so nothing is lost when
// email is down or not yet configured; it always shows in the admin inbox.
// `details` holds the fields that are specific to the kind of enquiry
// (area of interest, outlet, role...) as label -> text.
const enquirySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["volunteer", "media"] },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    details: { type: Map, of: String, default: {} },
    emailed: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  // Maps are plain objects in JSON replies (Mongoose would otherwise send {}).
  { timestamps: true, toJSON: { flattenMaps: true } }
);

enquirySchema.index({ createdAt: -1 });

export default mongoose.model("Enquiry", enquirySchema);
