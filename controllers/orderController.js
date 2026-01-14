import Order from "../models/Order.js"
import Product from "../models/Product.js"

// Create a new order
export const createOrder = async (req, res) => {
  try {
    const { farmerId, products, deliveryLocation } = req.body
    const buyerId = req.user.id

    if (!farmerId || !products || products.length === 0) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    // Validate products and calculate total
    let totalAmount = 0
    for (const item of products) {
      const product = await Product.findById(item.product)
      if (!product) {
        return res.status(404).json({ message: `Product ${item.product} not found` })
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient quantity for ${product.title}` })
      }
      totalAmount += product.price * item.quantity
    }

    const order = new Order({
      buyer: buyerId,
      farmer: farmerId,
      products,
      totalAmount,
      deliveryLocation,
      status: "placed",
    })

    await order.save()
    await order.populate("buyer", "name phone profilePic")
    await order.populate("farmer", "name phone address profilePic")
    await order.populate("products.product", "title price imageUrl")

    res.status(201).json({ message: "Order created successfully", order })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get orders for a user (buyer or farmer)
export const getOrders = async (req, res) => {
  try {
    const userId = req.user.id
    const { role } = req.query

    let filter = {}
    if (role === "buyer") {
      filter = { buyer: userId }
    } else if (role === "farmer") {
      filter = { farmer: userId }
    } else {
      filter = { $or: [{ buyer: userId }, { farmer: userId }] }
    }

    const orders = await Order.find(filter)
      .populate("buyer", "name phone profilePic")
      .populate("farmer", "name phone address profilePic")
      .populate("products.product", "title price imageUrl category")
      .sort({ createdAt: -1 })

    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get single order details
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("buyer", "name phone address profilePic location")
      .populate("farmer", "name phone address profilePic location")
      .populate("products.product", "title price imageUrl category description")

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (
      req.user.role !== "admin" &&
      order.buyer.toString() !== req.user.id &&
      order.farmer.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    res.json(order)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Update order status (farmer accepts/rejects)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!["accepted", "rejected", "shipped", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.farmer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    order.status = status
    await order.save()
    await order.populate("buyer", "name phone profilePic")
    await order.populate("farmer", "name phone profilePic")
    await order.populate("products.product", "title price")

    res.json({ message: `Order status updated to ${status}`, order })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Buyer cancels order
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    if (order.buyer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    if (["shipped", "delivered"].includes(order.status)) {
      return res.status(400).json({ message: "Cannot cancel order in current status" })
    }

    order.status = "cancelled"
    await order.save()

    res.json({ message: "Order cancelled successfully", order })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
