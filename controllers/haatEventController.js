import HaatEvent from "../models/HaatEvent.js"
import User from "../models/User.js"

export const createHaatEvent = async (req, res) => {
  try {
    const { name, description, latitude, longitude, address, eventDate, registrationDeadline } = req.body

    if (!name || !description || !latitude || !longitude || !address) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const haatEvent = new HaatEvent({
      name,
      description,
      location: {
        latitude,
        longitude,
        address,
      },
      eventDate,
      registrationDeadline,
      createdBy: req.user.id,
    })

    await haatEvent.save()
    res.status(201).json({ message: "Haat event created successfully", haatEvent })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getHaatEvents = async (req, res) => {
  try {
    const { status } = req.query
    const filter = {}

    if (status) filter.status = status

    const events = await HaatEvent.find(filter)
      .populate("createdBy", "name")
      .populate("farmerRegistrations.farmer", "name address location")

    res.json(events)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getHaatEvent = async (req, res) => {
  try {
    const event = await HaatEvent.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("farmerRegistrations.farmer", "name address location")

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    res.json(event)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const registerForHaatEvent = async (req, res) => {
  try {
    const event = await HaatEvent.findById(req.params.eventId)

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    const farmer = await User.findById(req.user.id)

    if (farmer.role !== "farmer") {
      return res.status(403).json({ message: "Only farmers can register" })
    }

    // Check if farmer is within radius
    const earthRadiusKm = 6371
    const lat1 = (farmer.location.latitude * Math.PI) / 180
    const lat2 = (event.location.latitude * Math.PI) / 180
    const deltaLat = ((event.location.latitude - farmer.location.latitude) * Math.PI) / 180
    const deltaLng = ((event.location.longitude - farmer.location.longitude) * Math.PI) / 180

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = earthRadiusKm * c

    if (distance > event.location.radius) {
      return res.status(400).json({
        message: `Farmer is ${distance.toFixed(2)} km away. Must be within ${event.location.radius} km`,
      })
    }

    // Check if already registered
    const alreadyRegistered = event.farmerRegistrations.some((reg) => reg.farmer.toString() === req.user.id)

    if (alreadyRegistered) {
      return res.status(400).json({ message: "Farmer already registered for this event" })
    }

    event.farmerRegistrations.push({ farmer: req.user.id })
    await event.save()

    res.json({ message: "Registered successfully", event })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const updateHaatEventStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!["upcoming", "active", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const event = await HaatEvent.findByIdAndUpdate(req.params.id, { status }, { new: true })

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    res.json({ message: "Event status updated", event })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
