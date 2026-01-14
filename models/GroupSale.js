import mongoose from "mongoose"

const groupSaleSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    haatEvent: { type: mongoose.Schema.Types.ObjectId, ref: "HaatEvent" },

    // Group sale details
    requiredQuantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    deadline: { type: Date, required: true },

    // Buyer participation
    participants: [
      {
        buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        quantity: { type: Number, required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ["open", "closed", "completed", "cancelled"],
      default: "open",
    },

    totalQuantityRequired: { type: Number },
    totalQuantitySold: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("GroupSale", groupSaleSchema)
