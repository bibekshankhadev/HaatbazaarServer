/**
 * 
 * protect is a middleware to protect routes that require authentication.
 * authorizeRoles is a middleware to authorize users based on their roles.
 * uploadSingle is a middleware to handle single file uploads.
 */

import express from "express";
import {protect, authorizeRoles} from "../middleware/auth.js";
import {uploadSingle} from "../middleware/upload.js";
import {createProduct, getProducts, getProduct, updateProduct, deleteProduct} from "../controllers/productController.js";


const router = express.Router();
// Route to create a new product (only farmers and admins can create products)

router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/", protect, authorizeRoles("farmer", "admin"), uploadSingle, createProduct);
router.put("/:id", protect, authorizeRoles("farmer", "admin"), uploadSingle, updateProduct);
router.delete("/:id", protect, authorizeRoles("farmer", "admin"), deleteProduct);
export default router;
