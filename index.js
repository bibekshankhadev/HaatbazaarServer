import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import { connectDB } from "./config/db.js"
import authRoutes from "./routes/authRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import haatEventRoutes from "./routes/haatEventRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import negotiationRoutes from "./routes/negotiationRoutes.js"
import groupSaleRoutes from "./routes/groupSaleRoutes.js"
import locationRoutes from "./routes/locationRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import path from "path"

dotenv.config()
const app = express()

app.use(cors())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

connectDB()

app.use("/api/auth", authRoutes)
app.use("/api/products", productRoutes)
app.use("/api/haat-events", haatEventRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/negotiations", negotiationRoutes)
app.use("/api/group-sales", groupSaleRoutes)
app.use("/api/location", locationRoutes)
app.use("/api/admin", adminRoutes)

app.use("/uploads", express.static(path.join(path.resolve(), "uploads")))

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running", timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
