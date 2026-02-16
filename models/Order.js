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
      enum: ["placed", "accepted", "packing", "rejected", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
    totalAmount: { type: Number, required: true },
    deliveryLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
    },
    // Delivery options
    deliveryOption: {
      type: String,
      enum: ["self_pickup", "request_delivery"],
      default: "self_pickup",
    },
    deliveryStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected", "in_transit", "completed"],
      default: "pending",
    },
    deliveryRequest: {
      isRequested: { type: Boolean, default: false },
      requestedAt: { type: Date },
      respondedAt: { type: Date },
      response: { type: String, enum: ["accepted", "rejected"] },
    },
    // Payment details
    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "esewa"],
      default: "cash_on_delivery",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentDetails: {
      transactionId: String,
      transactionUuid: String,
      referenceId: String,
      paidAt: Date,
      amount: Number,
      esewaStatus: String,
      statusCheckedAt: Date,
    },
    inventoryDeducted: { type: Boolean, default: false },
    orderDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("Order", orderSchema)
