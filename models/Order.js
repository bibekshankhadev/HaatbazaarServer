import mongoose from "mongoose"

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["placed", "accepted", "rejected", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
    totalAmount: { type: Number, required: true },
    deliveryLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
    },
    orderDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("Order", orderSchema)
