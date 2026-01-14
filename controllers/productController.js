/**
 * manages product-related operations like creation, read, update, and delete (CRUD).
 */

import Product from "../models/Product.js"
import fs from "fs";
import exifParser from "exif-parser"
import axios from "axios";

const extractExifData = async (imagePath) => {
  try {
    let buffer;

    // Check if imagePath is URL (Cloudinary)
    if (imagePath.startsWith("http")) {
      const response = await axios.get(imagePath, { responseType: "arraybuffer" });
      buffer = Buffer.from(response.data);
    } else {
      // Local multer file
      buffer = fs.readFileSync(imagePath);
    }

    const parser = exifParser.create(buffer);
    const result = parser.parse();

    // Try multiple EXIF date tags
    const dateTag = result.tags.DateTimeOriginal || result.tags.CreateDate || result.tags.DateTime;
    const photoDate = dateTag ? new Date(dateTag * 1000) : null;

    console.log("EXIF tags:", result.tags);
    console.log("Photo Date:", photoDate);

    return { photoDate };
  } catch (error) {
    console.log("Could not extract EXIF data:", error.message);
    return { photoDate: null };
  }
};

// Create a new product
/**
 * get information from currently logged farmer id
 *
 */
export const createProduct = async (req, res) => {
  try {
    const farmerId = req.user.id
    const { title, description, price, quantity, category, freshness, haatEventId } = req.body

    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" })
    }

    const { photoDate } = await extractExifData(req.file.path)
    const uploadDate = new Date()

    // Check if photo date is within 24 hours of upload (tolerance)
    const isValidated = photoDate ? Math.abs(uploadDate - photoDate) / (1000 * 60 * 60) <= 24 : false

    const product = new Product({
      farmer: farmerId,
      title,
      description,
      price,
      quantity,
      category,
      freshness,
      imageUrl: req.file.path,
      haatEvent: haatEventId || null,
      imageMetadata: {
        uploadDate,
        photoDate,
        isValidated,
      },
      status: "pending",
      approved: false,
    })

    await product.save()
    res.status(201).json({
      message: "Product created successfully (pending admin approval)",
      product,
      imageValidation: {
        isValidated,
        uploadDate,
        photoDate,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get all products
export const getProducts = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, q, page = 1, limit = 12, haatEventId } = req.query
    const filter = { approved: true, status: "approved" }

    if (category) filter.category = category
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) }
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) }
    if (q) filter.title = new RegExp(q, "i")
    if (haatEventId) filter.haatEvent = haatEventId

    const skip = (page - 1) * limit
    const total = await Product.countDocuments(filter)
    const products = await Product.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .populate("farmer", "name profilePic")
      .populate("haatEvent", "name location")

    res.json({ total, page: Number(page), products })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get a single product
/**
 * fetch a specific product by Id
 * populate farmer names, email, phone, address, and profilePic
 * populate haatEvent name and location
 * returns 404 if not found
 */

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("farmer", "name phone address profilePic")
      .populate("haatEvent", "name location")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Update a product
/**
 * find product by id and returns error if product is not found
 * Ensure that only the farmers can edit their own products.
 * Admins can bypass this restriction.
 * apply updates from request body
 * update image if new one is updated
 * re-validate EXIF if new image uploaded
 * save and return the updated product
 */

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) return res.status(404).json({ message: "Product not found" })

    if (req.user.role !== "admin" && product.farmer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    Object.assign(product, req.body)

    if (req.file) {
      product.imageUrl = req.file.path
      const { photoDate } = await extractExifData(req.file.path)
      const uploadDate = new Date()
      const isValidated = photoDate ? Math.abs(uploadDate - photoDate) / (1000 * 60 * 60) <= 24 : false

      product.imageMetadata = {
        uploadDate,
        photoDate,
        isValidated,
      }
    }

    await product.save()
    res.json({ message: "Product updated successfully", product })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Delete a product
/**
 * find product by id
 * return error if not found
 * restricts deletion to product owner or admins
 * delete associated image from server
 * remove product from database
 * return success message
 *
 */

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) return res.status(404).json({ message: "Product not found" })

    if (req.user.role !== "admin" && product.farmer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    await product.deleteOne()
    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getPendingProducts = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    const products = await Product.find({ status: "pending" })
      .populate("farmer", "name phone address")
      .populate("haatEvent", "name")

    res.json(products)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const updateProductStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    const { status } = req.body
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status, approved: status === "approved" },
      { new: true },
    )

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json({ message: `Product ${status}`, product })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
