import mongoose from "mongoose"

const haatEventSchema = new mongoose.Schema(
  {
    // Event details
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String }, // Cloudinary image URL

    // Location-based (Haat location)
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, required: true },
      radius: { type: Number, default: 5 }, // 5 km radius for farmer eligibility
    },

    // Event dates
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },
    eventDate: { type: Date }, // Kept for backward compatibility

    // Admin management
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["upcoming", "active", "completed", "cancelled"],
      default: "upcoming",
    },

    // Participation tracking
    farmerRegistrations: [
      {
        farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        registeredAt: { type: Date, default: Date.now },
      },
    ],

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("HaatEvent", haatEventSchema)
