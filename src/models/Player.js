import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    position: { type: String, trim: true },
    squadNumber: { type: Number },
    dateOfBirth: { type: Date },
    nationality: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
    bio: { type: String, trim: true },
    stats: {
      appearances: { type: Number, default: 0 },
      goals: { type: Number, default: 0 },
      assists: { type: Number, default: 0 },
    },
    role: {
      type: String,
      // "management" covers non-technical club officials (Chairman, CEO, etc.)
      // for the About > Management Team section — added here rather than a
      // new model since it's the same "person profile" shape as players/coaches.
      enum: ["player", "coach", "technical_staff", "management"],
      default: "player",
    },
    title: { type: String, trim: true }, // e.g. "Chairman", "Head Coach" — mainly for coach/management roles
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Player", playerSchema);
