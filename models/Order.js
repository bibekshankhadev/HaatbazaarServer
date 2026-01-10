// Store the name of the buyer
// store the name of the farmer
// store the list of products ordered (product id, quantity, price at the time of order)
// store the ordered status (placed, shipped, delivered, cancelled)
// store the total amount
// store the order date
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        products: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
                quantity: { type: Number, required: true },
                price: { type: Number, required: true }, // price at the time of order
            }
        ],
        status: { type: String, enum: ["placed", "shipped", "delivered", "cancelled"], default: "placed" },
        totalAmount: { type: Number, required: true },
        orderDate: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default mongoose.model("Order", orderSchema);