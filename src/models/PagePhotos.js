import mongoose from "mongoose";

// Up to three photos for the intro collage at the top of a page that would
// otherwise be mostly text (media accreditation, contact, careers...). `key`
// names the page. Edited in the admin panel under Page photos.
export const PAGE_PHOTO_KEYS = ["media-accreditation", "contact", "careers", "sponsors", "trophies", "club-history", "volunteer", "campus-ambassador"];

const pagePhotosSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, enum: PAGE_PHOTO_KEYS },
    images: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: { validator: (v) => v.length <= 3, message: "At most 3 photos per page" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("PagePhotos", pagePhotosSchema);
