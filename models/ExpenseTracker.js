import mongoose from "mongoose"

const expenseTrackerSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseProject",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "seeds",
        "fertilizer",
        "pesticide",
        "pesticides",
        "irrigation",
        "labor",
        "equipment",
        "water",
        "land_rent",
        "transportation",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    title: {
      type: String,
      required: false,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
    },
    unit: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    notes: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

expenseTrackerSchema.index({ farmer: 1, date: -1 })
expenseTrackerSchema.index({ farmer: 1, project: 1, date: -1 })

export default mongoose.model("ExpenseTracker", expenseTrackerSchema)
