import Negotiation from "../models/Negotiation.js"
import Product from "../models/Product.js"

// Initiate negotiation or place first offer
export const createNegotiation = async (req, res) => {
  try {
    const { productId, product, price, quantity, message } = req.body
    const resolvedProductId = productId || product
    const buyerId = req.user.id

    if (!resolvedProductId || price == null || quantity == null) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const selectedProduct = await Product.findById(resolvedProductId)

    if (!selectedProduct) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Check if negotiation already exists
    let negotiation = await Negotiation.findOne({
      product: resolvedProductId,
      buyer: buyerId,
      status: "active",
    })

    if (negotiation) {
      // Add new offer to existing negotiation
      negotiation.offers.push({
        offeredBy: buyerId,
        price,
        quantity,
        message,
      })
    } else {
      // Create new negotiation
      negotiation = new Negotiation({
        product: resolvedProductId,
        buyer: buyerId,
        farmer: selectedProduct.farmer,
        offers: [
          {
            offeredBy: buyerId,
            price,
            quantity,
            message,
          },
        ],
      })
    }

    await negotiation.save()
    await negotiation.populate("buyer", "name phone profilePic")
    await negotiation.populate("farmer", "name phone profilePic")
    await negotiation.populate("product", "title price quantity imageUrl")

    res.status(201).json({ message: "Offer placed successfully", negotiation })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Farmer responds to negotiation
export const respondToNegotiation = async (req, res) => {
  try {
    const { price, quantity, message, action } = req.body
    const farmerId = req.user.id

    if (!["counter", "accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" })
    }

    const negotiation = await Negotiation.findById(req.params.id)

    if (!negotiation) {
      return res.status(404).json({ message: "Negotiation not found" })
    }

    if (negotiation.farmer.toString() !== farmerId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" })
    }

    if (action === "accept") {
      negotiation.status = "accepted"
      negotiation.finalPrice = price
      negotiation.finalQuantity = quantity
      negotiation.acceptedAt = new Date()
    } else if (action === "reject") {
      negotiation.status = "rejected"
    } else {
      // Counter offer
      negotiation.offers.push({
        offeredBy: farmerId,
        price,
        quantity,
        message,
      })
    }

    await negotiation.save()
    await negotiation.populate("buyer", "name phone profilePic")
    await negotiation.populate("farmer", "name phone profilePic")
    await negotiation.populate("product", "title price quantity")

    res.json({ message: "Negotiation updated", negotiation })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get negotiations for a user
export const getNegotiations = async (req, res) => {
  try {
    const userId = req.user.id
    const { status, product } = req.query

    const filter = {
      $or: [{ buyer: userId }, { farmer: userId }],
    }

    if (status) filter.status = status
    if (product) filter.product = product

    const negotiations = await Negotiation.find(filter)
      .populate("buyer", "name phone profilePic")
      .populate("farmer", "name phone profilePic")
      .populate("product", "title price quantity imageUrl")
      .sort({ createdAt: -1 })

    res.json(negotiations)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get single negotiation
export const getNegotiation = async (req, res) => {
  try {
    const negotiation = await Negotiation.findById(req.params.id)
      .populate("buyer", "name phone address profilePic location")
      .populate("farmer", "name phone address profilePic location")
      .populate("product", "title price quantity imageUrl category")

    if (!negotiation) {
      return res.status(404).json({ message: "Negotiation not found" })
    }

    if (
      req.user.role !== "admin" &&
      negotiation.buyer.toString() !== req.user.id &&
      negotiation.farmer.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Unauthorized" })
    }

    res.json(negotiation)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
