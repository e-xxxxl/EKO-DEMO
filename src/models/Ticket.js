import mongoose from "mongoose";

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
    // 6 characters, uppercase alphanumeric, excluding easily-confused
    // characters (0/O, 1/I/L) — short enough to read aloud or type at a
    // gate, still a 1-in-~78 million collision space per code.
    code: { type: String, required: true, unique: true, uppercase: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

ticketSchema.index({ match: 1 });

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTicketCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export default mongoose.model("Ticket", ticketSchema);
