/**
 * manages product-related operations like creation, read, update, and delete (CRUD).
 */

import Product from "../models/Product.js"
import User from "../models/User.js"
import GroupSale from "../models/GroupSale.js"
import HaatEvent from "../models/HaatEvent.js"
import { createNotification } from "./notificationController.js"
import fs from "fs";
import exifParser from "exif-parser"
import axios from "axios";

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const isPhotoWithin24Hours = (photoDate, uploadDate) => {
  if (!photoDate || !uploadDate) return false
  const diffInHours = Math.abs(uploadDate - photoDate) / (1000 * 60 * 60)
  return diffInHours <= 24
}

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

    if (haatEventId) {
      const isValidEventId = /^[a-fA-F0-9]{24}$/.test(String(haatEventId))
      if (!isValidEventId) {
        return res.status(400).json({ message: "Invalid event id" })
      }

      const eventExists = await HaatEvent.exists({ _id: haatEventId })
      if (!eventExists) {
        return res.status(404).json({ message: "Event not found" })
      }
    }

    const { photoDate } = await extractExifData(req.file.path)
    const uploadDate = new Date()

    // Check if photo date is within 24 hours of upload (tolerance)
    const isValidated = isPhotoWithin24Hours(photoDate, uploadDate)

    const autoApprove = isValidated === true;

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
      status: autoApprove ? "approved" : "pending",
      approved: !!autoApprove,
    })

    await product.save()
    res.status(201).json({
      message: autoApprove
        ? "Product created and auto-approved successfully"
        : "Product created successfully (pending admin approval due to image date older than 1 day or missing EXIF date)",
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

// ===== GET ALL PRODUCTS FOR LOGGED-IN FARMER =====
// Get logged-in farmer products
// FARMER: get their own products
export const getProductsByFarmer = async (req, res) => {
  try {
    const farmerId = req.user.id;

    const products = await Product.find({ farmer: farmerId })
      .populate("farmer", "name _id")
      .populate("haatEvent", "name location");

    res.json({ products }); // MUST wrap in { products: [...] }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


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

    const { haatEventId, ...restBody } = req.body
    Object.assign(product, restBody)

    if (haatEventId !== undefined) {
      if (!haatEventId) {
        product.haatEvent = null
      } else {
        const isValidEventId = /^[a-fA-F0-9]{24}$/.test(String(haatEventId))
        if (!isValidEventId) {
          return res.status(400).json({ message: "Invalid event id" })
        }

        const eventExists = await HaatEvent.exists({ _id: haatEventId })
        if (!eventExists) {
          return res.status(404).json({ message: "Event not found" })
        }

        product.haatEvent = haatEventId
      }
    }

    if (req.file) {
      product.imageUrl = req.file.path
      const { photoDate } = await extractExifData(req.file.path)
      const uploadDate = new Date()
      const isValidated = isPhotoWithin24Hours(photoDate, uploadDate)

      product.imageMetadata = {
        uploadDate,
        photoDate,
        isValidated,
      }

      // Auto-approve if image validation passes, otherwise mark pending
      if (isValidated) {
        product.status = "approved"
        product.approved = true
      } else {
        product.status = "pending"
        product.approved = false
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

    await createNotification(
      product.farmer,
      req.user.id,
      "product_status",
      `Product ${status}`,
      `Your product "${product.title}" was ${status} by admin.`,
      { productId: product._id },
    )

    res.json({ message: `Product ${status}`, product })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get products with smart distance-based sorting
// Events near you -> Products near you -> Other products
export const getSmartProducts = async (req, res) => {
  try {
    const { latitude, longitude, limit = 20, page = 1, q } = req.query;

    // Get buyer location
    let buyerLat = latitude;
    let buyerLon = longitude;

    // If no location provided, try to get from user profile
    if (!buyerLat || !buyerLon) {
      const user = await User.findById(req.user.id);
      if (user && user.location) {
        buyerLat = user.location.latitude;
        buyerLon = user.location.longitude;
      } else {
        return res.status(400).json({ message: "Buyer location required" });
      }
    }

    // Build filter for search
    const filter = { approved: true, status: "approved" };
    if (q) {
      filter.title = new RegExp(q, "i");
    }

    // Fetch all approved products with farmer and event details
    const allProducts = await Product.find(filter)
      .populate("farmer", "name phone location profilePic address")
      .populate("haatEvent", "name location");

    // Add distance calculations to products
    const productsWithDistance = allProducts.map((product) => {
      let eventDistance = Infinity;
      let farmerDistance = Infinity;
      let sortPriority = 3; // Default: other products

      // Calculate distance to haatEvent
      if (product.haatEvent && product.haatEvent.location) {
        eventDistance = calculateDistance(
          buyerLat,
          buyerLon,
          product.haatEvent.location.latitude,
          product.haatEvent.location.longitude
        );
        if (eventDistance <= 50) {
          sortPriority = 1; // Event products priority
        }
      }

      // Calculate distance to farmer
      if (product.farmer && product.farmer.location) {
        farmerDistance = calculateDistance(
          buyerLat,
          buyerLon,
          product.farmer.location.latitude,
          product.farmer.location.longitude
        );
        if (sortPriority === 3 && farmerDistance <= 50) {
          sortPriority = 2; // Farmer products priority
        }
      }

      return {
        ...product.toObject(),
        eventDistance: eventDistance === Infinity ? null : parseFloat(eventDistance.toFixed(2)),
        farmerDistance: farmerDistance === Infinity ? null : parseFloat(farmerDistance.toFixed(2)),
        sortPriority,
      };
    });

    // Sort by priority and distance
    const sortedProducts = productsWithDistance.sort((a, b) => {
      // First sort by priority (1, 2, 3)
      if (a.sortPriority !== b.sortPriority) {
        return a.sortPriority - b.sortPriority;
      }

      // Then sort by relevant distance
      let distanceA = a.eventDistance !== null ? a.eventDistance : a.farmerDistance || Infinity;
      let distanceB = b.eventDistance !== null ? b.eventDistance : b.farmerDistance || Infinity;

      return distanceA - distanceB;
    });

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedProducts = sortedProducts.slice(skip, skip + limit);

    res.json({
      success: true,
      total: sortedProducts.length,
      page: Number(page),
      limit: Number(limit),
      products: paginatedProducts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}

// Get bulk buy products (group sales + products with >10kg quantity)
export const getBulkBuyProducts = async (req, res) => {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedMinKg = Number.parseFloat(req.query.minKg);
    const inclusive = req.query.inclusive === "true";

    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 10;
    const thresholdKg = Number.isFinite(parsedMinKg) && parsedMinKg >= 0 ? parsedMinKg : 10;

    const toKilograms = (quantity, unit) => {
      const numericQuantity = Number(quantity);
      if (!Number.isFinite(numericQuantity) || numericQuantity < 0) return 0;
      const normalizedUnit = String(unit || "kg").trim().toLowerCase();

      if (["g", "gram", "grams"].includes(normalizedUnit)) {
        return numericQuantity / 1000;
      }

      return numericQuantity;
    };

    const meetsThreshold = (quantityInKg) => {
      return inclusive ? quantityInKg >= thresholdKg : quantityInKg > thresholdKg;
    };

    const [approvedProducts, groupSales] = await Promise.all([
      Product.find({
        approved: true,
        status: "approved",
        quantity: { $gt: 0 },
      })
        .populate("farmer", "name phone location profilePic address")
        .populate("haatEvent", "name location")
        .sort({ quantity: -1, createdAt: -1 }),
      GroupSale.find({ status: "open" })
        .populate("farmer", "name phone location profilePic address")
        .populate("product", "title imageUrl price category description quantity quantityUnit unit")
        .populate("haatEvent", "name location")
        .sort({ deadline: 1, createdAt: -1 }),
    ]);

    const highQuantityProducts = approvedProducts
      .filter((product) => {
        const quantityInKg = toKilograms(product.quantity, product.quantityUnit || product.unit);
        return meetsThreshold(quantityInKg);
      })
      .map((product) => {
        const quantityInKg = toKilograms(product.quantity, product.quantityUnit || product.unit);
        return {
          ...product.toObject(),
          quantityInKg: Number(quantityInKg.toFixed(2)),
          bulkBuyType: "high_quantity",
          bulkBuyReason: `${Number(quantityInKg.toFixed(2))}kg available`,
        };
      });

    const groupSaleProducts = groupSales
      .filter((groupSale) => groupSale.product)
      .map((groupSale) => {
        const committed = Number(groupSale.totalQuantitySold || 0);
        const required = Number(groupSale.requiredQuantity || 0);
        const remaining = Math.max(required - committed, 0);
        return {
          ...groupSale.product.toObject(),
          farmer: groupSale.farmer,
          bulkBuyType: "group_sale",
          bulkBuyReason: `Group sale: ${committed}/${required}kg committed`,
          groupSaleId: groupSale._id,
          groupSaleDeadline: groupSale.deadline,
          groupSalePrice: groupSale.pricePerUnit,
          originalPrice: groupSale.product.price,
          groupSaleRequiredQuantity: required,
          groupSaleSoldQuantity: committed,
          groupSaleRemainingQuantity: Number(remaining.toFixed(2)),
        };
      });

    const allBulkBuyProducts = [...highQuantityProducts, ...groupSaleProducts];
    const total = allBulkBuyProducts.length;
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const products = allBulkBuyProducts.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      thresholdKg,
      inclusive,
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}
