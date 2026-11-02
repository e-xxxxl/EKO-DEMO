import mongoose from "mongoose";
import { randomInt } from "node:crypto";

// One document per physical ticket, not per order line — an order for
// "3× Regular" produces 3 of these, each independently scannable/usable.
// Created once (in routes/webhooks.js's markOrderPaid) when a ticket order
// is confirmed paid; never created client-side or trusted from a request.
const ticketSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true },
    ticketType: { type: mongoose.Schema.Types.ObjectId, ref: "TicketType", required: true },
    ticketTypeName: { type: String, required: true }, // snapshot, same reasoning as Order line items
    holderName: { type: String, required: true, trim: true },
    holderEmail: { type: String, trim: true, lowercase: true },
    holderPhone: { type: String, trim: true },
    // New tickets get 8 digits (shown as "1234 5678"): easy to read aloud or
    // type at a gate, and the same value is encoded in the QR code. Tickets
    // issued before this carry 6 letters and digits and keep working.
    code: { type: String, required: true, unique: true, uppercase: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

ticketSchema.index({ match: 1 });

export function generateTicketCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

// Accepts what a person types or a scanner reads: spaces, dashes and case
// don't matter ("1234 5678", "1234-5678" and "12345678" are the same ticket).
export function normalizeTicketCode(raw) {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export default mongoose.model("Ticket", ticketSchema);
