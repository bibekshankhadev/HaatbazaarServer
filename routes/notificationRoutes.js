import express from "express"
import { protect  } from "../middleware/auth.js"
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerExpoPushToken,
} from "../controllers/notificationController.js"

const router = express.Router()

// Get all notifications for current user
router.get("/", protect , getUserNotifications)

// Get unread count
router.get("/unread-count", protect , getUnreadCount)

// Register Expo push token
router.put("/push-token", protect, registerExpoPushToken)

// Mark all as read
router.put("/mark-all/read", protect , markAllAsRead)

// Mark notification as read
router.put("/:notificationId/read", protect , markAsRead)

// Delete notification
router.delete("/:notificationId", protect , deleteNotification)

export default router
