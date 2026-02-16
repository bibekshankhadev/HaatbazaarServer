import express from "express"
import { protect, authorizeRoles } from "../middleware/auth.js"
import { uploadSingle } from "../middleware/upload.js"
import {
  createHaatEvent,
  getHaatEvents,
  getHaatEvent,
  registerForHaatEvent,
  updateHaatEventStatus,
  updateHaatEvent,
  deleteHaatEvent,
} from "../controllers/haatEventController.js"

const router = express.Router()

// Admin only - create events
router.post("/", protect, authorizeRoles("admin"), uploadSingle, createHaatEvent)

// Get all events
router.get("/", getHaatEvents)

// Get single event
router.get("/:id", getHaatEvent)

// Farmer registers for event
router.post("/:eventId/register", protect, authorizeRoles("farmer"), registerForHaatEvent)

// Admin update event status
router.put("/:id/status", protect, authorizeRoles("admin"), updateHaatEventStatus)

// Admin edit event
router.put("/:eventId", protect, authorizeRoles("admin"), updateHaatEvent)

// Admin delete event
router.delete("/:eventId", protect, authorizeRoles("admin"), deleteHaatEvent)

export default router
