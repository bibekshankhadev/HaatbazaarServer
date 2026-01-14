import mongoose from "mongoose"

const locationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number }, // Accuracy radius in meters
    timestamp: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }, // Most recent location is active
  },
  { timestamps: true },
)

// Index for geospatial queries
locationSchema.index({ latitude: 1, longitude: 1 })

export default mongoose.model("Location", locationSchema)
