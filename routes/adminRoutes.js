import express from "express"
import { protect, authorizeRoles } from "../middleware/auth.js"
import {
  approveFarmer,
  rejectFarmer,
  getPendingFarmers,
  getAllUsers,
  getDashboardStats,
  getRevenueReport,
  deleteUser,
  getPendingNegotiations,
} from "../controllers/adminController.js"

const router = express.Router()

// Admin only routes
router.use(protect, authorizeRoles("admin"))

// Farmer management
router.get("/farmers/pending", getPendingFarmers)
router.put("/farmers/:userId/approve", approveFarmer)
router.put("/farmers/:userId/reject", rejectFarmer)

// User management
router.get("/users", getAllUsers)
router.delete("/users/:userId", deleteUser)

// Dashboard and reports
router.get("/dashboard/stats", getDashboardStats)
router.get("/reports/revenue", getRevenueReport)

// Moderation
router.get("/negotiations/pending", getPendingNegotiations)

export default router
