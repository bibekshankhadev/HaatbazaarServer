import express from "express"
import { protect } from "../middleware/auth.js"
import {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  initiateEsewaPayment,
  verifyEsewaPayment,
  renderEsewaCheckoutForm,
} from "../controllers/orderController.js"

const router = express.Router()

// Create order
router.post("/", protect, createOrder)

// Get user's orders
router.get("/", protect, getOrders)

// Public helper to auto-submit signed eSewa form via browser
router.get("/esewa/checkout", renderEsewaCheckoutForm)

// Get single order
router.get("/:id", protect, getOrder)

// eSewa payment
router.post("/:id/esewa/initiate", protect, initiateEsewaPayment)
router.post("/:id/esewa/verify", protect, verifyEsewaPayment)

// Update order status (farmer accepts/rejects)
router.put("/:id/status", protect, updateOrderStatus)

// Cancel order (buyer)
router.delete("/:id", protect, cancelOrder)

export default router
