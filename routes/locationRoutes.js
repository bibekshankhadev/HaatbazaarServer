import express from "express"
import { protect } from "../middleware/auth.js"
import {
  updateLocation,
  getActiveLocation,
  getLocationHistory,
  findFarmersNearby,
} from "../controllers/locationController.js"

const router = express.Router()

// Update current user location
router.post("/update", protect, updateLocation)

// Get location history
router.get("/history", protect, getLocationHistory)

// Get active location of a specific user
router.get("/user/:userId", getActiveLocation)

// Find farmers nearby
router.get("/nearby/farmers", protect, findFarmersNearby)

export default router
