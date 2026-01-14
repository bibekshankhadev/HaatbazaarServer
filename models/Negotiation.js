import mongoose from "mongoose"

const negotiationSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Negotiation history
    offers: [
      {
        offeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // buyer or farmer
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ["active", "accepted", "rejected", "expired"],
      default: "active",
    },

    finalPrice: { type: Number },
    finalQuantity: { type: Number },
    acceptedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("Negotiation", negotiationSchema)
