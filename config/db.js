// config/db.js
// // Import the Mongoose library to interact with MongoDB

import mongoose from "mongoose"


/**
 * Connects to the MongoDB database using Mongoose.
 * 
 * - Reads the MongoDB URI from environment variables (process.env.MONGO_URI).
 * - Uses async/await for clean asynchronous handling.
 * - Logs a success message when connected, or exits the process on failure.
 * 
 * ⚠️ Ensure MONGO_URI is correctly set in your .env file.
 * Example: MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/dbname
 */

export const connectDB = async ()=>{
    try
    {
        // Attempt to connect to MongoDB using the connection string from the environment variable
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,      // Use the new URL string parser (recommended by Mongoose)
            useUnifiedTopology: true,   // Use the new unified topology engine for connection management
        })
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error)
    {
        console.error("MongoDB connection error:", error);

        // Exit the application with a non-zero status code (1) to indicate failure
        process.exit(1);
    }
}