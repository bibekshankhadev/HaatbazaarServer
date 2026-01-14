import mongoose from "mongoose"

const productSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    freshness: { type: Number, required: true },
    imageUrl: { type: String, required: true },

    imageMetadata: {
      uploadDate: { type: Date }, // When image was uploaded to Cloudinary
      photoDate: { type: Date }, // When photo was actually taken (from EXIF)
      isValidated: { type: Boolean, default: false }, // True if dates match within tolerance
    },

    haatEvent: { type: mongoose.Schema.Types.ObjectId, ref: "HaatEvent" },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("Product", productSchema)
