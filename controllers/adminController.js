import User from "../models/User.js"
import Product from "../models/Product.js"
import HaatEvent from "../models/HaatEvent.js"
import Order from "../models/Order.js"
import Negotiation from "../models/Negotiation.js"
import GroupSale from "../models/GroupSale.js"

// Approve farmer account
export const approveFarmer = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { approved: true }, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "farmer") {
      return res.status(400).json({ message: "User is not a farmer" })
    }

    res.json({ message: "Farmer approved successfully", user })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Reject farmer account
export const rejectFarmer = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { approved: false }, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "Farmer rejected", user })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get pending farmers
export const getPendingFarmers = async (req, res) => {
  try {
    const farmers = await User.find({ role: "farmer", approved: false }).select("-password")

    res.json(farmers)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get all users with role filtering
export const getAllUsers = async (req, res) => {
  try {
    const { role, approved } = req.query
    const filter = {}

    if (role) filter.role = role
    if (approved !== undefined) filter.approved = approved === "true"

    const users = await User.find(filter).select("-password").sort({ createdAt: -1 })

    res.json(users)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const totalFarmers = await User.countDocuments({ role: "farmer" })
    const approvedFarmers = await User.countDocuments({ role: "farmer", approved: true })
    const pendingFarmers = await User.countDocuments({ role: "farmer", approved: false })
    const totalBuyers = await User.countDocuments({ role: "buyer" })

    const totalProducts = await Product.countDocuments()
    const approvedProducts = await Product.countDocuments({ approved: true })
    const pendingProducts = await Product.countDocuments({ status: "pending" })
    const rejectedProducts = await Product.countDocuments({ status: "rejected" })

    const totalOrders = await Order.countDocuments()
    const completedOrders = await Order.countDocuments({ status: "delivered" })
    const pendingOrders = await Order.countDocuments({ status: "placed" })

    const totalGroupSales = await GroupSale.countDocuments()
    const activeGroupSales = await GroupSale.countDocuments({ status: "open" })

    const totalHaatEvents = await HaatEvent.countDocuments()
    const upcomingEvents = await HaatEvent.countDocuments({ status: "upcoming" })
    const activeEvents = await HaatEvent.countDocuments({ status: "active" })

    const stats = {
      users: {
        total: totalUsers,
        farmers: {
          total: totalFarmers,
          approved: approvedFarmers,
          pending: pendingFarmers,
        },
        buyers: totalBuyers,
      },
      products: {
        total: totalProducts,
        approved: approvedProducts,
        pending: pendingProducts,
        rejected: rejectedProducts,
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        pending: pendingOrders,
      },
      groupSales: {
        total: totalGroupSales,
        active: activeGroupSales,
      },
      haatEvents: {
        total: totalHaatEvents,
        upcoming: upcomingEvents,
        active: activeEvents,
      },
    }

    res.json(stats)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get revenue reports
export const getRevenueReport = async (req, res) => {
  try {
    const orders = await Order.find({ status: "delivered" }).populate("farmer", "name")

    const revenueByFarmer = {}
    let totalRevenue = 0

    orders.forEach((order) => {
      const farmerName = order.farmer.name
      if (!revenueByFarmer[farmerName]) {
        revenueByFarmer[farmerName] = { amount: 0, orders: 0 }
      }
      revenueByFarmer[farmerName].amount += order.totalAmount
      revenueByFarmer[farmerName].orders += 1
      totalRevenue += order.totalAmount
    })

    res.json({
      totalRevenue,
      byFarmer: revenueByFarmer,
      totalOrders: orders.length,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Delete user (dangerous operation)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "User deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get pending negotiations for moderation
export const getPendingNegotiations = async (req, res) => {
  try {
    const negotiations = await Negotiation.find({ status: "active" })
      .populate("buyer", "name phone")
      .populate("farmer", "name phone")
      .populate("product", "title")
      .sort({ createdAt: -1 })

    res.json(negotiations)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
