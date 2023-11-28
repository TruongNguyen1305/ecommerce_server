import mongoose from "mongoose";


const OrderSchema = new mongoose.Schema({
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    buyer: {
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
    deliveryFee: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ["preparing", "prepared", "delivering", "delivered", "completed"],
        default: 'preparing'
    },
    shippingName: {
        type: String,
    },
    shippingCode: {
        type: String,
    },
    address: String,
    province: String,
    district: String,
    ward: String,
}, {
    timestamps: true
})

 
const Order = mongoose.model('Order', OrderSchema)

export default Order;