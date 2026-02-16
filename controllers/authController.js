import User from "../models/User.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import nodemailer from "nodemailer"

const OTP_TTL_MS = 10 * 60 * 1000

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  })

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex")

const normalizeInput = (value) => {
  if (!value) return null
  if (Array.isArray(value)) return normalizeInput(value[0])
  const normalized = String(value).trim()
  if (!normalized) return null
  const lower = normalized.toLowerCase()
  if (lower === "null" || lower === "undefined") return null
  return normalized
}

const normalizeEmail = (value) => {
  const normalized = normalizeInput(value)
  return normalized ? normalized.toLowerCase() : null
}

const createOtp = () => String(crypto.randomInt(100000, 1000000))

const sendOtpEmail = async (email, otp) => {
  const requiredEnvKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]
  const missingEnvKeys = requiredEnvKeys.filter((key) => !process.env[key])

  if (missingEnvKeys.length > 0) {
    console.error(
      `SMTP configuration missing: ${missingEnvKeys.join(", ")}`,
    )
    return false
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Haatbazaar password reset OTP",
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
  })

  return true
}

export const register = async (req, res) => {
  try {
    const { name, phone, email, password, role, address } = req.body
    const normalizedEmail = normalizeEmail(email)

    const latitude = req.body.latitude ? Number(req.body.latitude) : null
    const longitude = req.body.longitude ? Number(req.body.longitude) : null

    if (
      latitude === null ||
      longitude === null ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return res.status(400).json({ message: "Invalid location" })
    }

    if (!name || !phone || !normalizedEmail || !password || !req.file) {
      return res.status(400).json({ message: "Required fields missing" })
    }

    const existingUser = await User.findOne({
      $or: [{ phone }, { email: normalizedEmail }],
    })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      name,
      phone,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "buyer",
      address: role === "farmer" ? address : undefined,
      profilePic: req.file.path,
      approved: role === "farmer" ? false : true,
      location: {
        latitude,
        longitude,
      },
    })

    const token = generateToken(user._id)

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        profilePic: user.profilePic,
        location: user.location,
      },
    })
  } catch (error) {
    console.error("Register error:", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const login = async (req, res) => {
  const phone = normalizeInput(req.body.phone)
  const password = normalizeInput(req.body.password)

  if (!phone || !password) {
    return res
      .status(400)
      .json({ message: "Phone number and password are required" })
  }

  try {
    const user = await User.findOne({ phone })
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid phone number or password" })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid phone or password" })
    }

    if (user.role === "farmer" && !user.approved) {
      return res
        .status(403)
        .json({ message: "Farmer account not approved yet" })
    }

    res.json({
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        profilePic: user.profilePic,
      },
      token: generateToken(user._id),
    })
  } catch (error) {
    console.error("Login error:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const phone = normalizeInput(req.body.phone)

  if (!email && !phone) {
    return res.status(400).json({ message: "Email or phone is required" })
  }

  try {
    if (email && phone) {
      return res
        .status(400)
        .json({ message: "Please provide either email or phone, not both" })
    }

    const query = email ? { email } : { phone }
    const user = await User.findOne(query)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const otp = createOtp()
    user.resetPasswordToken = hashValue(otp)
    user.resetPasswordExpires = new Date(Date.now() + OTP_TTL_MS)
    await user.save({ validateBeforeSave: false })

    const type = email ? "email" : "phone"
    const destination = email || phone

    if (email) {
      try {
        const emailSent = await sendOtpEmail(email, otp)
        if (!emailSent) {
          return res
            .status(500)
            .json({ message: "Email service is not configured" })
        }
      } catch (error) {
        console.error("Failed to send OTP email:", error.message)
        return res.status(500).json({ message: "Failed to send OTP email" })
      }
    } else {
      console.log(`Password reset OTP for ${phone}: ${otp}`)
    }

    res.json({
      message: `OTP sent to your ${type}`,
      destination,
      type,
    })
  } catch (error) {
    console.error("Forgot password error:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}

export const verifyOTP = async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const phone = normalizeInput(req.body.phone)
  const otp = normalizeInput(req.body.otp)

  if ((!email && !phone) || !otp) {
    return res
      .status(400)
      .json({ message: "Email/phone and OTP are required" })
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "Invalid OTP format" })
  }

  try {
    const query = email ? { email } : { phone }
    const user = await User.findOne(query)

    if (
      !user ||
      !user.resetPasswordToken ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "OTP is invalid or expired" })
    }

    const otpHash = hashValue(otp)
    if (user.resetPasswordToken !== otpHash) {
      return res.status(400).json({ message: "OTP is invalid or expired" })
    }

    const resetToken = crypto.randomBytes(32).toString("hex")
    user.resetPasswordToken = hashValue(resetToken)
    user.resetPasswordExpires = new Date(Date.now() + OTP_TTL_MS)
    await user.save({ validateBeforeSave: false })

    res.json({
      message: "OTP verified successfully",
      token: resetToken,
    })
  } catch (error) {
    console.error("Verify OTP error:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}

export const resetPassword = async (req, res) => {
  const token = normalizeInput(req.body.token)
  const newPassword = normalizeInput(req.body.newPassword)

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Reset token and new password are required" })
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" })
  }

  try {
    const tokenHash = hashValue(token)
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    })

    if (!user) {
      return res
        .status(400)
        .json({ message: "Reset token is invalid or expired" })
    }

    user.password = await bcrypt.hash(newPassword, 10)
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save({ validateBeforeSave: false })

    res.json({ message: "Password reset successfully" })
  } catch (error) {
    console.error("Reset password error:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}
