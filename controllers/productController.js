/**
 * manages product-related operations like creation, read, update, and delete (CRUD). 
 */

import Product from '../models/Product.js';

// import fs for file system operations like deleting images when images are removed or updated
import fs from 'fs';
import path from 'path';

// Create a new product
/**
 * get information from currently logged farmer id
 * 
 */
export const createProduct = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { title, description, price, quantity, category, freshness } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const product = new Product({
      farmer: farmerId,
      title,
      description,
      price,
      quantity,
      category,
      freshness,
      imageUrl: req.file.path, // ✅ Cloudinary URL
    });

    await product.save();
    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// With above code farmers can list their product for sales.

// Get all products
export const getProducts = async (req, res) => {
    try {
        const { category, minPrice, maxPrice, q, page=1, limit=12 } = req.query;
        const filter = {approved: true};

        if (category) filter.category = category;
        if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
        if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };
        if (q) filter.title = new RegExp(q, 'i');
        
        // Pagination
        // 
        const skip = (page - 1) * limit;
        const total = await Product.countDocuments(filter);
        const products = await Product.find(filter)
        .skip(skip)
        .limit(Number(limit))

        // replace the farmer id with their names
        .populate('farmer', 'name');
        res.json({total, page: Number(page), products});
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    };
};

// With above code the application now efficiently filters for the buyers experiences.

// Get a single product 
/**
 * fetch a specific product by Id
 * populate farmet names and email
 * returns 404 if not found
 */

export const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('farmer', 'name email');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    };
};

// With above code buyers can view detailed information about a specific product information and seller's details.

// Update a product
/**
 * find product by id and returns error if product is not found
 * Ensure that only the farmers can edit their own products.
 * Admins can bypass this restriction.
 * apply updates from request body
 * update image if new one is updated
 * save and return the updated product
 */

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: "Product not found" });

    if (req.user.role !== "admin" && product.farmer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    Object.assign(product, req.body);

    if (req.file) {
      product.imageUrl = req.file.path; // ✅ Cloudinary URL
    }

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// With above code farmers can update their product details when needed.


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
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: "Product not found" });

    if (req.user.role !== "admin" && product.farmer.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
