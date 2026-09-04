import mongoose from "mongoose";

// Snapshot the name/price on each line item at order time — if a Product's
// price changes later, past orders must still show what was actually paid.
const orderItemSchema = new mongoose.Schema(
  {
    refType: { type: String, enum: ["Product", "TicketType"], required: true },
    ref: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "items.refType" },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 }, // snapshot — always server-computed, never taken from the client
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String, trim: true }, // only meaningful for shop items with sizes
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["shop", "ticket"], required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    customerPhone: { type: String, trim: true },
    totalAmount: { type: Number, required: true, min: 0 }, // sum of unitPrice*quantity, computed server-side at creation
    currency: { type: String, default: "NGN" },
    paymentProvider: { type: String, enum: ["paystack", "flutterwave"] },
    paymentReference: { type: String, trim: true, index: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
    fulfilled: { type: Boolean, default: false }, // shop orders only — has the physical item shipped/been collected
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
