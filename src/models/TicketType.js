import mongoose from "mongoose";

// General admission model, not assigned seating: a ticket type is a priced
// category (e.g. "Regular", "VIP") with a quantity cap per match, not an
// individual numbered seat. See PROGRESS.md for why — flagged as a deliberate
// scope decision, not an oversight.
const ticketTypeSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Regular", "VIP", "Student"
    price: { type: Number, required: true, min: 0 }, // Naira — never trust a client-supplied price at checkout
    quantityAvailable: { type: Number, required: true, min: 0 },
    quantitySold: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ticketTypeSchema.index({ match: 1 });
ticketTypeSchema.virtual("quantityRemaining").get(function () {
  return Math.max(0, this.quantityAvailable - this.quantitySold);
});
ticketTypeSchema.set("toJSON", { virtuals: true });

export default mongoose.model("TicketType", ticketTypeSchema);
