import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    farmer:{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
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