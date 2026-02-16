import HaatEvent from "../models/HaatEvent.js"
import User from "../models/User.js"
import { createNotification, sendNotificationToMultiple } from "./notificationController.js"

export const createHaatEvent = async (req, res) => {
  try {
    const { name, description, latitude, longitude, address, startDate, endDate, registrationDeadline, radius } = req.body

    if (!name || !description || !latitude || !longitude || !address || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    // Get image URL from uploaded file
    let image = null
    if (req.file) {
      image = req.file.path // Cloudinary URL
    }

    const haatEvent = new HaatEvent({
      name,
      description,
      image,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        radius: parseInt(radius) || 5,
      },
      startDate,
      endDate,
      eventDate: startDate, // For backward compatibility
      registrationDeadline:
        registrationDeadline ||
        new Date(new Date(startDate).setDate(new Date(startDate).getDate() - 1)),
      createdBy: req.user.id,
    })

    await haatEvent.save()

    try {
      const farmers = await User.find({ role: "farmer", approved: true }).select("_id")
      const farmerIds = farmers.map((farmer) => farmer._id)

      if (farmerIds.length > 0) {
        await sendNotificationToMultiple(
          farmerIds,
          "new_event",
          `New event: ${haatEvent.name}`,
          `${haatEvent.name} is scheduled for ${new Date(haatEvent.startDate).toLocaleDateString()} at ${haatEvent.location.address}.`,
          { eventId: haatEvent._id },
        )
      }
    } catch (notifError) {
      console.log("New event notification error:", notifError.message)
    }

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
      .populate("farmerRegistrations.farmer", "name address location phone profilePic")

    res.json(events)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getHaatEvent = async (req, res) => {
  try {
    const event = await HaatEvent.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("farmerRegistrations.farmer", "name address location phone profilePic")

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

    if (farmer.location?.latitude == null || farmer.location?.longitude == null) {
      return res.status(400).json({ message: "Farmer location is required to register for events" })
    }

    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ message: "Registration deadline has passed for this event" })
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

    // Send notification to all admins
    try {
      // Find all admin users
      const admins = await User.find({ role: "admin" })

      // Create notification for each admin
      for (const admin of admins) {
        await createNotification(
          admin._id,
          req.user.id,
          "farmer_request",
          `New Farmer Registration for ${event.name}`,
          `${farmer.name} (${farmer.phone}) has registered for "${event.name}". They are ${distance.toFixed(2)} km from the event location.`,
          {
            eventId: event._id,
            farmerId: req.user.id,
          },
        )
      }
    } catch (notifError) {
      console.log("Notification error:", notifError.message)
      // Don't fail the registration if notification fails
    }

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

// Edit event
export const updateHaatEvent = async (req, res) => {
  try {
    const { eventId } = req.params
    const { name, description, latitude, longitude, address, startDate, endDate, registrationDeadline, image, radius } = req.body

    const event = await HaatEvent.findById(eventId)

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    // Check if user is admin/creator
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to edit this event" })
    }

    // Update fields
    if (name) event.name = name
    if (description) event.description = description
    if (image) event.image = image
    if (startDate) {
      event.startDate = startDate
      event.eventDate = startDate
    }
    if (endDate) event.endDate = endDate
    if (registrationDeadline) event.registrationDeadline = registrationDeadline
    if (latitude && longitude && address) {
      event.location = {
        latitude,
        longitude,
        address,
        radius: radius || event.location.radius,
      }
    }

    await event.save()

    res.json({ message: "Event updated successfully", event })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Delete event
export const deleteHaatEvent = async (req, res) => {
  try {
    const { eventId } = req.params

    const event = await HaatEvent.findById(eventId)

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    // Check if user is admin/creator
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this event" })
    }

    await HaatEvent.findByIdAndDelete(eventId)

    res.json({ message: "Event deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
