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
    version: { type: String, enum: ["replica", "player"] }, // jerseys sold in two versions
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
    subtotalAmount: { type: Number, min: 0 }, // sum of unitPrice*quantity before any referral discount
    discountAmount: { type: Number, default: 0, min: 0 }, // referral discount taken off, computed server-side
    referralCode: { type: String, trim: true, uppercase: true, index: true }, // snapshot of the code used, for tracking
    referralOwner: { type: String, trim: true }, // snapshot of the name the code belongs to
    totalAmount: { type: Number, required: true, min: 0 }, // what is charged: subtotal minus discount, computed server-side at creation
    marketingConsent: { type: Boolean, default: false }, // ticked "send me emails and SMS from the club"
    consentAt: { type: Date },
    accessToken: { type: String }, // lets the buyer, and only the buyer, see their tickets on the success page
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
