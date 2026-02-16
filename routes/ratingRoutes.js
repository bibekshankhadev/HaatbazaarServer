import express from 'express'
import { protect } from '../middleware/auth.js'
import { createRating, getRatingsForUser, searchRateableUsers } from '../controllers/ratingController.js'

const router = express.Router()

// Create rating
router.post('/', protect, createRating)

// Search users for rating
router.get('/users/search', protect, searchRateableUsers)

// Get ratings for a user
router.get('/:userId', getRatingsForUser)

export default router
