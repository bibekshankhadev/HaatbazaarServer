import express from "express"
import { protect, authorizeRoles } from "../middleware/auth.js"
import {
  createGroupSale,
  getGroupSales,
  getGroupSale,
  joinGroupSale,
  updateGroupSaleStatus,
} from "../controllers/groupSaleController.js"

const router = express.Router()

// Create group sale (farmer only)
router.post("/", protect, authorizeRoles("farmer", "admin"), createGroupSale)

// Get all group sales
router.get("/", getGroupSales)

// Get single group sale
router.get("/:id", getGroupSale)

// Join group sale (buyer)
router.post("/:id/join", protect, joinGroupSale)

// Update group sale status
router.put("/:id/status", protect, updateGroupSaleStatus)

export default router
