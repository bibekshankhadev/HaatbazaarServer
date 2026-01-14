// handles user authentication and login in express backend
// Make use of MONGODB, JWT and bcryptjs for password hashing and secure authentication

// Import mongoose database model that we in models/User.js
import User from "../models/User.js"; // User model
import bcrypt from "bcryptjs"; // for password hashing
import jwt from "jsonwebtoken"; // for generating and verifying JWT tokens

// Generate JWT token
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d", // token expires in 7 days
  });

/**
 * 
 * jwt.sign(payload, secret, options) creates a token:

Payload → { id } (the user’s MongoDB ID)

Secret → stored in environment variable JWT_SECRET

Expiry → "7d" (token valid for 7 days)
 */

// With the above code now users can authenticate themselves securely after login/signin without re-entering their password everytime

export const register = async (req, res) => {
  try {
    const { name, phone, password, role, address } = req.body;

    // Validate required fields
    if (!name || !phone || !password) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Profile picture is compulsory
    if (!req.file) {
      return res.status(400).json({ message: "Profile picture is required" });
    }
    console.log("FILE:", req.file);
    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      phone,
      password: hashedPassword,
      role: role || "buyer",
      address: role === "farmer" ? address : undefined,
      profilePic: req.file.path, // ✅ Cloudinary URL
      approved: role === "farmer" ? false : true,
    });

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        profilePic: user.profilePic,
      },
    });

    const { latitude, longitude } = req.body;

    user.location = {
      latitude,
      longitude,
    };
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// Login Controller
export const login = async (req, res) => {
  const { phone, password } = req.body;
  try {
    // Find user by phone number
    const user = await User.findOne({ phone });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid phone number or password" });
    }
    // check if user exists and if not return error (invalid email or password)
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid phone or password" });
    }
    // if password does not match return error and deny access
    // Check if farmer is approved
    if (user.role === "farmer" && !user.approved) {
      return res
        .status(403)
        .json({ message: "Farmer account not approved yet" });
    }
    // Farmer will have to wait for the admin approvals
    //This is done to prevent farmers from accessing the marketplace features.
    res.json({
      user: {
        id: user._id,
        name: user.name,
        // email: user.email,
        phone: user.phone,
        role: user.role,
        profilePic: user.profilePic,
      },

      token: generateToken(user._id), // generate JWT token
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
