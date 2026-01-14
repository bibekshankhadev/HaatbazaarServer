import GroupSale from "../models/GroupSale.js"
import Product from "../models/Product.js"

// Create a group sale
export const createGroupSale = async (req, res) => {
  try {
    const { productId, requiredQuantity, pricePerUnit, deadline, haatEventId } = req.body
    const farmerId = req.user.id

    if (!productId || !requiredQuantity || !pricePerUnit || !deadline) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const product = await Product.findById(productId)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (product.farmer.toString() !== farmerId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    const groupSale = new GroupSale({
      product: productId,
      farmer: farmerId,
      haatEvent: haatEventId || null,
      requiredQuantity,
      pricePerUnit,
      deadline,
      totalQuantityRequired: requiredQuantity,
    })

    await groupSale.save()
    await groupSale.populate("farmer", "name phone profilePic")
    await groupSale.populate("product", "title imageUrl")

    res.status(201).json({ message: "Group sale created successfully", groupSale })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get all active group sales
export const getGroupSales = async (req, res) => {
  try {
    const { status, haatEventId } = req.query

    const filter = { status: status || "open" }
    if (haatEventId) filter.haatEvent = haatEventId

    const groupSales = await GroupSale.find(filter)
      .populate("farmer", "name phone profilePic")
      .populate("product", "title imageUrl price category")
      .populate("haatEvent", "name location")
      .sort({ deadline: 1 })

    res.json(groupSales)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get single group sale details
export const getGroupSale = async (req, res) => {
  try {
    const groupSale = await GroupSale.findById(req.params.id)
      .populate("farmer", "name phone address profilePic")
      .populate("product", "title description imageUrl price category")
      .populate("participants.buyer", "name phone profilePic")
      .populate("haatEvent", "name location")

    if (!groupSale) {
      return res.status(404).json({ message: "Group sale not found" })
    }

    res.json(groupSale)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Join a group sale
export const joinGroupSale = async (req, res) => {
  try {
    const { quantity } = req.body
    const buyerId = req.user.id

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" })
    }

    const groupSale = await GroupSale.findById(req.params.id)

    if (!groupSale) {
      return res.status(404).json({ message: "Group sale not found" })
    }

    if (groupSale.status !== "open") {
      return res.status(400).json({ message: "Group sale is no longer open" })
    }

    // Check if buyer already joined
    const alreadyJoined = groupSale.participants.some((p) => p.buyer.toString() === buyerId)

    if (alreadyJoined) {
      return res.status(400).json({ message: "You already joined this group sale" })
    }

    // Check if total quantity would exceed required
    const currentTotal = groupSale.participants.reduce((sum, p) => sum + p.quantity, 0)
    if (currentTotal + quantity > groupSale.requiredQuantity) {
      return res.status(400).json({
        message: `Adding ${quantity} units would exceed required quantity. Available: ${groupSale.requiredQuantity - currentTotal}`,
      })
    }

    groupSale.participants.push({ buyer: buyerId, quantity })
    groupSale.totalQuantitySold = currentTotal + quantity

    // Close if required quantity reached
    if (groupSale.totalQuantitySold >= groupSale.requiredQuantity) {
      groupSale.status = "closed"
    }

    await groupSale.save()
    await groupSale.populate("participants.buyer", "name phone profilePic")

    res.json({ message: "Joined group sale successfully", groupSale })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Update group sale status (farmer closes/completes)
export const updateGroupSaleStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!["open", "closed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const groupSale = await GroupSale.findById(req.params.id)

    if (!groupSale) {
      return res.status(404).json({ message: "Group sale not found" })
    }

    if (groupSale.farmer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    groupSale.status = status
    await groupSale.save()

    res.json({ message: `Group sale status updated to ${status}`, groupSale })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
