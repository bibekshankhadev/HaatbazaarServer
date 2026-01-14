import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["buyer", "farmer", "admin"],
      default: "buyer",
    },
    address: { type: String, required: false },
    profilePic: { type: String, required: true },
    approved: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
  { timestamps: true },
)

userSchema.path("address").required(function () {
  return this.role === "farmer"
})

export default mongoose.model("User", userSchema)
