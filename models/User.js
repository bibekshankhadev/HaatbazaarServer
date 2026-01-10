import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // keep the email optional for farmers
    // email: { type: String, required: false, unique: true, sparse: true },
    phone:{type:String, required:true, unique:true},
    password: { type: String, required: true },
    role: { type: String, enum: ["buyer", "farmer", "admin"], default: "buyer" },
    address: { type: String, required: false },
    // NEW: Compulsory profile picture
    profilePic: { type: String, required: true }, // URL or file path
    approved: { type: Boolean, default: false }, // admins approve farmers
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// address required is true only if role is farmer
userSchema.path("address").required(function () {
  return this.role === "farmer";
});

export default mongoose.model("User", userSchema);
