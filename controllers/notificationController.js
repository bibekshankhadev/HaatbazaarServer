import Notification from "../models/Notification.js"
import User from "../models/User.js"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
const PUSH_NOTIFICATION_TYPES = new Set(["delivery_request", "order_placed", "new_event"])

const isExpoPushToken = (token) =>
  typeof token === "string" &&
  token.startsWith("ExponentPushToken[") &&
  token.endsWith("]")

const sendExpoPushNotifications = async (tokens, title, message, data = {}) => {
  try {
    const validTokens = Array.from(new Set(tokens.filter(isExpoPushToken)))
    if (validTokens.length === 0) return

    const messages = validTokens.map((to) => ({
      to,
      sound: "default",
      title,
      body: message,
      data,
      priority: "high",
    }))

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    })
  } catch (error) {
    console.log("Expo push send error:", error.message)
  }
}

const emitNotificationEvent = async (recipientId, payload) => {
  try {
    const { getIO } = await import("../index.js")
    const io = getIO()
    if (io) {
      io.to(`notifications-${recipientId}`).emit("new-notification", payload)
    }
  } catch (error) {
    console.log("Socket emit error:", error.message)
  }
}

// Get all notifications for a user
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id
    const { isRead } = req.query

    const filter = { recipient: userId }
    if (isRead !== undefined) {
      filter.isRead = isRead === "true"
    }

    const notifications = await Notification.find(filter)
      .populate("sender", "name profilePic")
      .populate("recipient", "name")
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({
      success: true,
      notifications,
      unreadCount: await Notification.countDocuments({ recipient: userId, isRead: false }),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// Get unread notification count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id
    const count = await Notification.countDocuments({ recipient: userId, isRead: false })
    res.json({ success: true, unreadCount: count })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params
    const userId = req.user.id

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" })
    }

    res.json({ success: true, notification })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    )

    res.json({ success: true, message: "All notifications marked as read" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params
    const userId = req.user.id

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    })

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" })
    }

    res.json({ success: true, message: "Notification deleted" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// Save or update expo push token for current user
export const registerExpoPushToken = async (req, res) => {
  try {
    const userId = req.user.id
    const { expoPushToken } = req.body || {}

    if (!isExpoPushToken(expoPushToken)) {
      return res.status(400).json({ success: false, message: "Invalid Expo push token" })
    }

    await User.findByIdAndUpdate(userId, { expoPushToken }, { new: true })
    res.json({ success: true, message: "Push token saved" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

// Create notification (internal use)
export const createNotification = async (recipientId, senderIdOrNull, type, title, message, relatedData = {}) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderIdOrNull,
      type,
      title,
      message,
      relatedData,
    })

    await notification.save()

    await emitNotificationEvent(recipientId, {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedData: notification.relatedData,
      createdAt: notification.createdAt,
      isRead: false,
    })

    if (PUSH_NOTIFICATION_TYPES.has(type)) {
      const recipient = await User.findById(recipientId).select("expoPushToken")
      const token = recipient?.expoPushToken

      if (token) {
        await sendExpoPushNotifications([token], title, message, {
          notificationId: notification._id,
          type,
          relatedData,
        })
      }
    }

    return notification
  } catch (error) {
    console.error("Error creating notification:", error)
    return null
  }
}

// Send notification to multiple users
export const sendNotificationToMultiple = async (recipientIds, type, title, message, relatedData = {}) => {
  try {
    const notifications = recipientIds.map((recipientId) => ({
      recipient: recipientId,
      type,
      title,
      message,
      relatedData,
      isRead: false,
    }))

    const result = await Notification.insertMany(notifications)

    await Promise.all(
      result.map((notification) =>
        emitNotificationEvent(notification.recipient.toString(), {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          relatedData: notification.relatedData,
          createdAt: notification.createdAt,
          isRead: false,
        }),
      ),
    )

    if (PUSH_NOTIFICATION_TYPES.has(type)) {
      const users = await User.find({
        _id: { $in: recipientIds },
        expoPushToken: { $exists: true, $ne: null },
      }).select("expoPushToken")

      const tokens = users.map((user) => user.expoPushToken).filter(Boolean)
      if (tokens.length > 0) {
        await sendExpoPushNotifications(tokens, title, message, {
          type,
          relatedData,
        })
      }
    }

    return result
  } catch (error) {
    console.error("Error creating notifications:", error)
    return null
  }
}
