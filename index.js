import express from "express";
// helps to use .env
import dotenv from "dotenv";

// CORS is a browser sercurity features in middleware that restricts web pages
// from making requests to a different domain or port than the originated from. 
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
// import orderRoutes from "./routes/OrderRoutes.js";
// import adminRoutes from "./routes/adminRoutes.js";
import path from "path";


dotenv.config();
const app = express();

// activate cors middleware for express
app.use(cors());
/**
 * restrict to certain origin if needed
 * example: app.use(cors({ origin: "http://localhost:3000" }));
 * if example is applied then the browser would block the API requests comming from other origin like front-end
 */

// automatically parse the json data
app.use(express.json());

connectDB();

app.use("/api/auth",authRoutes);
app.use("/api/products",productRoutes);
// app.use("/api/orders",orderRoutes);
// app.use("/api/admin",adminRoutes);

app.use("/uploads",express.static(path.join(path.resolve(),"uploads")));

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=> console.log(`Server is running on port ${PORT}`));