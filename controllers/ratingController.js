import Rating from '../models/Rating.js'
import User from '../models/User.js'
import mongoose from "mongoose"

export const createRating = async (req, res) => {
  try {
    const raterId = req.user.id
    const { targetId, score, comment } = req.body

    if (!targetId || !score) return res.status(400).json({ message: 'Missing fields' })
    if (req.user.role !== "buyer") {
      return res.status(403).json({ message: "Only buyers can submit ratings" })
    }

    const numericScore = Number(score)
    if (
      !Number.isFinite(numericScore) ||
      numericScore < 0.5 ||
      numericScore > 5 ||
      !Number.isInteger(numericScore * 2)
    ) {
      return res.status(400).json({ message: "Score must be between 0.5 and 5 in 0.5 steps" })
    }

    // Ensure target exists
    const target = await User.findById(targetId)
    if (!target) return res.status(404).json({ message: 'Target user not found' })
    if (target.role !== "farmer") {
      return res.status(400).json({ message: "Only farmers can be rated" })
    }

    // Prevent rating self
    if (String(targetId) === String(raterId)) return res.status(400).json({ message: 'Cannot rate yourself' })

    const existingRating = await Rating.findOne({ rater: raterId, target: targetId })
    let rating

    if (existingRating) {
      existingRating.score = numericScore
      existingRating.comment = comment
      rating = await existingRating.save()
    } else {
      rating = new Rating({ rater: raterId, target: targetId, score: numericScore, comment })
      await rating.save()
    }

    // compute new average
    const agg = await Rating.aggregate([
      { $match: { target: target._id } },
      { $group: { _id: '$target', avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ])

    const average = agg[0] ? agg[0].avg : numericScore
    const count = agg[0] ? agg[0].count : 1

    res.status(existingRating ? 200 : 201).json({
      message: existingRating ? 'Rating updated' : 'Rating created',
      rating,
      average,
      count,
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const getRatingsForUser = async (req, res) => {
  try {
    const { userId } = req.params
    const ratings = await Rating.find({ target: userId }).populate('rater', 'name profilePic')

    const agg = await Rating.aggregate([
      { $match: { target: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$target', avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ])

    const average = agg[0] ? agg[0].avg : null
    const count = agg[0] ? agg[0].count : 0

    res.json({ ratings, average, count })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

export const searchRateableUsers = async (req, res) => {
  try {
    const { q = "", role, limit = 10 } = req.query
    const roles = role ? role.split(",").map((value) => value.trim()) : ["buyer", "farmer"]
    const safeLimit = Math.min(Number(limit) || 10, 30)

    const filters = {
      _id: { $ne: req.user.id },
      role: { $in: roles },
    }

    if (q) {
      filters.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ]
    }

    const users = await User.find(filters)
      .select("name phone role profilePic")
      .sort({ name: 1 })
      .limit(safeLimit)

    res.json({ users })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
