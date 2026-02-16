import express from "express";
import {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getPendingProducts,
  updateProductStatus,
  getProductsByFarmer,
  getSmartProducts,
  getBulkBuyProducts,
} from "../controllers/productController.js";

import { protect, authorizeRoles } from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js"; // <-- use named export

const router = express.Router();

// PUBLIC
router.get("/", getProducts);
// BUYER - get smart ordered products
router.get("/smart/order", protect, authorizeRoles("buyer"), getSmartProducts);
// BUYER - get bulk buy products (group sales + >10kg)
router.get("/bulk-buy", protect, authorizeRoles("buyer"), getBulkBuyProducts);
router.get("/my-products", protect, authorizeRoles("farmer"), getProductsByFarmer); // must be BEFORE /:id
router.get("/:id", getProduct);

// FARMER
router.post(
  "/",
  protect,
  authorizeRoles("farmer"),
  uploadSingle,
  createProduct
);

// ADMIN
router.get("/pending", protect, authorizeRoles("admin"), getPendingProducts);
router.put("/:id/status", protect, authorizeRoles("admin"), updateProductStatus);

// OWNER / ADMIN
router.put("/:id", protect, authorizeRoles("farmer", "admin"), uploadSingle, updateProduct);
router.delete("/:id", protect, authorizeRoles("farmer", "admin"), deleteProduct);

export default router;
