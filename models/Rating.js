import mongoose from 'mongoose'

const ratingSchema = new mongoose.Schema(
  {
    rater: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: {
      type: Number,
      required: true,
      min: 0.5,
      max: 5,
      validate: {
        validator: (value) => Number.isInteger(value * 2),
        message: "Score must be in 0.5 steps",
      },
    },
    comment: { type: String },
  },
  { timestamps: true }
)

export default mongoose.model('Rating', ratingSchema)
