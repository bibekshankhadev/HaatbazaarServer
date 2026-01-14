import express from "express"
import { protect } from "../middleware/auth.js"
import { createOrder, getOrders, getOrder, updateOrderStatus, cancelOrder } from "../controllers/orderController.js"

const router = express.Router()

// Create order
router.post("/", protect, createOrder)

// Get user's orders
router.get("/", protect, getOrders)

// Get single order
router.get("/:id", protect, getOrder)

// Update order status (farmer accepts/rejects)
router.put("/:id/status", protect, updateOrderStatus)

// Cancel order (buyer)
router.delete("/:id", protect, cancelOrder)

export default router
