import mongoose from "mongoose";

// A club event shown on /events: a fan day, academy open day, community
// outreach, launch night. Added in the admin panel with a cover photo and
// optional extra photos.
const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 4000 },
    eventDate: { type: Date },
    location: { type: String, trim: true, maxlength: 200 },
    imageUrl: { type: String, trim: true }, // cover photo
    images: [{ type: String, trim: true }], // extra photos shown on the event page
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

eventSchema.index({ eventDate: -1 });

export default mongoose.model("Event", eventSchema);
