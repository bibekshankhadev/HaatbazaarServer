import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import { createServer } from "http"
import { Server } from "socket.io"
import { connectDB } from "./config/db.js"
import authRoutes from "./routes/authRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import haatEventRoutes from "./routes/haatEventRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import negotiationRoutes from "./routes/negotiationRoutes.js"
import groupSaleRoutes from "./routes/groupSaleRoutes.js"
import locationRoutes from "./routes/locationRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"
import ratingRoutes from "./routes/ratingRoutes.js"
import expenseTrackerRoutes from "./routes/expenseTrackerRoutes.js"
import path from "path"
import { fileURLToPath } from "url"
import HaatEvent from "./models/HaatEvent.js"
import User from "./models/User.js"
import Notification from "./models/Notification.js"
import { sendNotificationToMultiple } from "./controllers/notificationController.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, ".env") })
const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

app.use(cors({
  origin: "*",
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

connectDB()

const KALIMATI_SOURCE_URL = "https://kalimatimarket.gov.np/api/daily-prices/en"
const KALIMATI_CACHE_TTL_MS = 5 * 60 * 1000
const KALIMATI_TIMEOUT_MS = 10000
const EVENT_REMINDER_INTERVAL_MS = 5 * 60 * 1000
const EVENT_UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000
const EVENT_STARTING_SOON_WINDOW_MS = 60 * 60 * 1000
let kalimatiCache = {
  data: null,
  fetchedAt: 0,
}
let eventReminderRunning = false

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/products", productRoutes)
app.use("/api/haat-events", haatEventRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/negotiations", negotiationRoutes)
app.use("/api/group-sales", groupSaleRoutes)
app.use("/api/location", locationRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/ratings", ratingRoutes)
app.use("/api/expenses", expenseTrackerRoutes)

const fetchKalimatiPrices = async () => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), KALIMATI_TIMEOUT_MS)
  const response = await fetch(KALIMATI_SOURCE_URL, { signal: controller.signal })
  clearTimeout(timeout)
  if (!response.ok) {
    throw new Error(`Kalimati API error: ${response.status}`)
  }
  return response.json()
}

const getKalimatiPricesCached = async () => {
  const now = Date.now()
  const hasFreshCache =
    kalimatiCache.data && now - kalimatiCache.fetchedAt < KALIMATI_CACHE_TTL_MS

  if (hasFreshCache) {
    return { data: kalimatiCache.data, source: "cache", stale: false }
  }

  try {
    const data = await fetchKalimatiPrices()
    kalimatiCache = {
      data,
      fetchedAt: Date.now(),
    }
    return { data, source: "origin", stale: false }
  } catch (error) {
    if (kalimatiCache.data) {
      return { data: kalimatiCache.data, source: "cache", stale: true }
    }
    throw error
  }
}

app.get("/api/kalimati", async (req, res) => {
  try {
    const result = await getKalimatiPricesCached()
    res.set("x-kalimati-source", result.source)
    res.set("x-kalimati-stale", String(result.stale))
    res.json(result.data)
  } catch (error) {
    res.status(502).json({ message: "Failed to fetch Kalimati prices", error: error.message })
  }
})

app.get("/api/kalimati/recommendation", async (req, res) => {
  try {
    const { query = "" } = req.query
    const normalizedQuery = String(query).trim().toLowerCase()
    const result = await getKalimatiPricesCached()
    const data = result.data
    const prices = Array.isArray(data?.prices) ? data.prices : []

    const parsePrice = (value) => {
      const parsed = Number(String(value).replace(/[^0-9.]/g, ""))
      return Number.isFinite(parsed) ? parsed : null
    }

    const candidates = normalizedQuery
      ? prices.filter((item) =>
          String(item.commodityname || "").toLowerCase().includes(normalizedQuery),
        )
      : prices

    const withNumericPrice = candidates
      .map((item) => ({
        commodityName: item.commodityname,
        unit: item.commodityunit,
        avgPrice: parsePrice(item.avgprice),
        minPrice: parsePrice(item.minprice),
        maxPrice: parsePrice(item.maxprice),
      }))
      .filter((item) => item.avgPrice != null)

    if (withNumericPrice.length === 0) {
      return res.json({
        success: true,
        recommendation: null,
        matches: [],
        message: "No matching commodity found in Kalimati prices",
      })
    }

    const recommendation =
      withNumericPrice.reduce((sum, item) => sum + item.avgPrice, 0) / withNumericPrice.length

    res.json({
      success: true,
      recommendation: Number(recommendation.toFixed(2)),
      matches: withNumericPrice.slice(0, 10),
      totalMatches: withNumericPrice.length,
    })
  } catch (error) {
    res.status(502).json({ message: "Failed to fetch Kalimati recommendation", error: error.message })
  }
})

app.get("/", (req, res) => res.send("API is running"));


app.use("/uploads", express.static(path.join(path.resolve(), "uploads")))

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)

  // Join notification room for specific user
  socket.on("join-notifications", (userId) => {
    socket.join(`notifications-${userId}`)
    console.log(`User ${userId} joined notifications room`)
  })

  // Leave notification room
  socket.on("leave-notifications", (userId) => {
    socket.leave(`notifications-${userId}`)
  })

  // Join negotiation room
  socket.on("join-negotiation", (negotiationId) => {
    socket.join(`negotiation-${negotiationId}`)
    console.log(`Socket ${socket.id} joined negotiation room: ${negotiationId}`)
  })

  // Leave negotiation room
  socket.on("leave-negotiation", (negotiationId) => {
    socket.leave(`negotiation-${negotiationId}`)
  })

  // Send negotiation message
  socket.on("negotiation-message", (data) => {
    io.to(`negotiation-${data.negotiationId}`).emit("negotiation-update", data)
  })

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
  })
})

// Export io for use in controllers
export const getIO = () => io

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running", timestamp: new Date().toISOString() })
})

const getEventReminderMessage = (event) => {
  const startDateText = new Date(event.startDate).toLocaleString()
  return `${event.name} starts at ${startDateText} in ${event?.location?.address || "the event location"}.`
}

const sendMissingEventNotifications = async (event, type, title, message, buyerIds) => {
  if (!Array.isArray(buyerIds) || buyerIds.length === 0) return

  const existing = await Notification.find({
    type,
    recipient: { $in: buyerIds },
    "relatedData.eventId": event._id,
  }).select("recipient")

  const existingRecipients = new Set(existing.map((item) => String(item.recipient)))
  const recipients = buyerIds.filter((buyerId) => !existingRecipients.has(String(buyerId)))

  if (recipients.length === 0) return

  await sendNotificationToMultiple(recipients, type, title, message, { eventId: event._id })
}

const runEventReminderJob = async () => {
  if (eventReminderRunning) return
  eventReminderRunning = true

  try {
    const now = new Date()
    const upcomingEnd = new Date(now.getTime() + EVENT_UPCOMING_WINDOW_MS)

    const [events, buyers] = await Promise.all([
      HaatEvent.find({
        status: { $in: ["upcoming", "active"] },
        startDate: { $gt: now, $lte: upcomingEnd },
      }).select("_id name startDate location"),
      User.find({ role: "buyer" }).select("_id"),
    ])

    if (events.length === 0 || buyers.length === 0) return

    const buyerIds = buyers.map((buyer) => buyer._id)

    for (const event of events) {
      const msUntilStart = new Date(event.startDate).getTime() - now.getTime()

      if (msUntilStart <= EVENT_STARTING_SOON_WINDOW_MS) {
        await sendMissingEventNotifications(
          event,
          "event_starting_soon",
          `Event starting soon: ${event.name}`,
          getEventReminderMessage(event),
          buyerIds,
        )
        continue
      }

      await sendMissingEventNotifications(
        event,
        "event_upcoming",
        `Upcoming event: ${event.name}`,
        getEventReminderMessage(event),
        buyerIds,
      )
    }
  } catch (error) {
    console.log("Event reminder job error:", error.message)
  } finally {
    eventReminderRunning = false
  }
}

setInterval(() => {
  runEventReminderJob()
}, EVENT_REMINDER_INTERVAL_MS)

runEventReminderJob()

const PORT = process.env.PORT || 5000

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
