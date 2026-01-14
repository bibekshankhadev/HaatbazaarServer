import Location from "../models/Location.js"
import User from "../models/User.js"

// Update user location (from mobile app)
export const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body
    const userId = req.user.id

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Latitude and longitude are required" })
    }

    // Mark previous active location as inactive
    await Location.updateMany({ user: userId, isActive: true }, { isActive: false })

    // Create new location record
    const location = new Location({
      user: userId,
      latitude,
      longitude,
      accuracy,
      isActive: true,
    })

    await location.save()

    // Update user model with latest location
    await User.findByIdAndUpdate(userId, {
      location: {
        latitude,
        longitude,
      },
    })

    res.json({ message: "Location updated successfully", location })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get active location of a user
export const getActiveLocation = async (req, res) => {
  try {
    const userId = req.params.userId

    const location = await Location.findOne({ user: userId, isActive: true })

    if (!location) {
      return res.status(404).json({ message: "No active location found" })
    }

    res.json(location)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Get location history for a user
export const getLocationHistory = async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 10 } = req.query

    const locations = await Location.find({ user: userId }).sort({ timestamp: -1 }).limit(Number(limit))

    res.json(locations)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Find farmers near a location
export const findFarmersNearby = async (req, res) => {
  try {
    const { latitude, longitude, radiusKm = 5 } = req.query

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Latitude and longitude are required" })
    }

    const earthRadiusKm = 6371

    // Get all active farmer locations
    const locations = await Location.find({ isActive: true }).populate("user", "name role phone profilePic").lean()

    const nearbyFarmers = locations
      .filter((loc) => loc.user.role === "farmer")
      .map((loc) => {
        const lat1 = (latitude * Math.PI) / 180
        const lat2 = (loc.latitude * Math.PI) / 180
        const deltaLat = ((loc.latitude - latitude) * Math.PI) / 180
        const deltaLng = ((loc.longitude - longitude) * Math.PI) / 180

        const a =
          Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = earthRadiusKm * c

        return { ...loc, distance }
      })
      .filter((f) => f.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)

    res.json({ count: nearbyFarmers.length, farmers: nearbyFarmers })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
