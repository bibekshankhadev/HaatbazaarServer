import express from "express";
import { register, login } from "../controllers/authController.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

// Register user WITH profile picture
router.post("/register", uploadSingle, register);

// Login
router.post("/login", login);

export default router;
