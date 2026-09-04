import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 }, // Naira, whole/decimal — never trust a client-supplied price at checkout, always read this field server-side
    category: {
      type: String,
      enum: ["jersey", "apparel", "accessories", "other"],
      default: "other",
    },
    images: [{ type: String, trim: true }],
    sizes: [{ type: String, trim: true }], // e.g. ["S","M","L","XL"] — empty means "one size"
    stock: { type: Number, default: 0, min: 0 }, // single stock count for the product as a whole; per-size inventory isn't tracked separately (MVP simplification, flagged in PROGRESS.md)
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
