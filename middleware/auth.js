/**
 * verify if the user is authenticated
 * will be used on the routes that requires a logged-in users.
 * 
 */

import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    // get the authorization header (expected format: "Bearer <token>")
    const authHeader = req.headers.authorization;

    // If the header is missing or doesn't start with "Bearer ", return 401

    // 401 is Unauthorized status code.

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Not authorized, Your token is missing" });
    }
    
    // a token is a string that is sent to the client after successful login
    // the client sends back the token in the authorization header for protected routes

    const token = authHeader.split(" ")[1]; // Extract the token part

    try {
        // verify and decode the token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user by ID from token payload, exclude password field
        req.user = await User.findById(decoded.id).select("-password");

        // If user is not found then we will deny the access
        if (!req.user) {
            return res.status(401).json({ message: "Not authorized, User not found" });
        }

        next(); // proceed to the next middleware or route handler
    } catch (error) {
        
        // If token is invalid or expired -deny access
        console.error("Error in auth middleware:", error.message);
        res.status(401).json({ message: "Not authorized, Token is invalid" });
    }
};



/**
 * 
 * restricts the routes access based on user roles
 * example: authorizeRoles("admin","farmer")
 */

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        // Make sure that the user is authenticated
        if (!req.user) {
            return res.status(401).json({ message: "Not authorized" });
        }

        // Check if the user's role is in the allowed roles
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `User role '${req.user.role}' is not authorized to access this route` });
        }   

        // User is authorized
        next();
    };
};
