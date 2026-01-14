<<<<<<< HEAD
import mongoose from "mongoose"

const productSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
=======
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    farmer:{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
>>>>>>> db122b926354c07d3477bdc05aa7eb6fedc8aa5d
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
<<<<<<< HEAD
    freshness: { type: Number, required: true },
    imageUrl: { type: String, required: true },

    imageMetadata: {
      uploadDate: { type: Date }, // When image was uploaded to Cloudinary
      photoDate: { type: Date }, // When photo was actually taken (from EXIF)
      isValidated: { type: Boolean, default: false }, // True if dates match within tolerance
    },

    haatEvent: { type: mongoose.Schema.Types.ObjectId, ref: "HaatEvent" },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model("Product", productSchema)
=======
    // how many days since the veg/fruit is picked from soil
    freshness: { type: Number, required: true  },
    // upload the image of the product
    imageUrl: { type: String, required: true },

    approved: { type: Boolean, default: false }, // admins approve products
    
    // upload the date when the product is kept on sale
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
>>>>>>> db122b926354c07d3477bdc05aa7eb6fedc8aa5d
