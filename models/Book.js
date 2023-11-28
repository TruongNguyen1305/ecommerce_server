import mongoose from "mongoose";


const BookSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        // required: true
    },
    phone: {
        type: String,
        // required: true
    },
    genre: {
        type: String,
        required: true
    },
    author: {
        type: String,
    },
    desc: {
        type: String,
    },
    image: [String],
    originalPrice: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    condition: {
        type: Number,
        required: true
    },
    isSelling: {
        type: Boolean,
        default: false
    },
    publishFee: {
        type: Number,
        required: true
    },
    address: String,
    province: String,
    district: String,
    ward: String,
}, {
    timestamps: true
})

BookSchema.index({
    name: "text"
})
 
const Book = mongoose.model('Book', BookSchema)

export default Book;