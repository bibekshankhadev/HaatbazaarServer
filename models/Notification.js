import mongoose from "mongoose"

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: [
        "farmer_request",      // New farmer request for event
        "new_event",           // New event created
        "event_started",       // Event started
        "event_ended",         // Event ended
        "negotiation",         // Negotiation price update
        "negotiation_accepted",// Negotiation accepted
        "order_placed",        // Order placed
        "delivery_request",    // Delivery request
        "delivery_accepted",   // Delivery accepted
        "delivery_rejected",   // Delivery rejected
        "order_status",        // Buyer order status updates
        "event_upcoming",      // Event reminder for upcoming events
        "event_starting_soon", // Event starts within 1 hour
        "group_sale_invite",   // Group sale invitation
        "payment_received",    // Payment received
        "product_status",      // Product approved/rejected by admin
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedData: {
      eventId: mongoose.Schema.Types.ObjectId,
      orderId: mongoose.Schema.Types.ObjectId,
      negotiationId: mongoose.Schema.Types.ObjectId,
      farmerId: mongoose.Schema.Types.ObjectId,
      productId: mongoose.Schema.Types.ObjectId,
      groupSaleId: mongoose.Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

export default mongoose.model("Notification", notificationSchema)
