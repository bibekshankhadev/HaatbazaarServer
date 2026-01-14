/**
 * protect is a middleware to protect routes that require authentication.
 * authorizeRoles is a middleware to authorize users based on their roles.
 * uploadSingle is a middleware to handle single file uploads.
 */

import express from "express"
import { protect, authorizeRoles } from "../middleware/auth.js"
import { uploadSingle } from "../middleware/upload.js"
import {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getPendingProducts,
  updateProductStatus,
} from "../controllers/productController.js"

const router = express.Router()

// Public routes
router.get("/", getProducts)
router.get("/:id", getProduct)

// Protected farmer/admin routes
router.post("/", protect, authorizeRoles("farmer", "admin"), uploadSingle, createProduct)
router.put("/:id", protect, authorizeRoles("farmer", "admin"), uploadSingle, updateProduct)
router.delete("/:id", protect, authorizeRoles("farmer", "admin"), deleteProduct)

router.get("/admin/pending", protect, authorizeRoles("admin"), getPendingProducts)
router.put("/admin/:id/status", protect, authorizeRoles("admin"), updateProductStatus)

export default router
