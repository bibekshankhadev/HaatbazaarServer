import express from "express"
import { protect } from "../middleware/auth.js"
import {
  createNegotiation,
  respondToNegotiation,
  getNegotiations,
  getNegotiation,
} from "../controllers/negotiationController.js"

const router = express.Router()

// Create negotiation
router.post("/", protect, createNegotiation)

// Get user's negotiations
router.get("/", protect, getNegotiations)

// Get single negotiation
router.get("/:id", protect, getNegotiation)

// Respond to negotiation (counter/accept/reject)
router.put("/:id/respond", protect, respondToNegotiation)

export default router
