import Order from '../models/Order.js'
import Book from '../models/Book.js'


export const createOrder = async (req, res, next) => {
    try {
        const book = await Book.findById(req.body.book);
        if (book) {
            if (book.isSelling === false) {
                res.status(404).json('The book has been sold');
            }
            const user = req.user;
            const newOrder = await Order.create({
                buyer: user._id,
                ...req.body,
            });
            await Book.updateOne({ _id: req.body.book }, { $set: { isSelling: false } });
            res.status(200).json({ message: "Order created successfully", order: newOrder });
        } else {
            console.log('Book not found');
            res.status(404).json({ error: 'Book not found' });
        }
    } catch (error) {
        console.log(error.message);
        res.status(400).json({ error: error.message });
    }
}

export const getAllOrders = async (req, res, next) => {
    try {
        const orders = await Order.find();
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getOrderByUserId = async (req, res, next) => {
    try {
        const user = req.user;
        const orders = await Order.find({ buyer: user._id });
        res.status(200).json({ orders });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: error.message });
    }
}

export const removeOrder = async (req, res, next) => {
    try {
        const user = req.user;
        const orderId = req.params.id;
        const orderToDelete = await Order.findOne({ _id: orderId, buyer: user });
        if (!orderToDelete) {
            res.status(404).json({ error: 'Order not found or does not belong to the current user.' });
        }
        const bookId = orderToDelete.book;
        await Book.updateOne({ _id: bookId }, { $set: { isSelling: true } });
        await orderToDelete.remove();
        res.status(200).json({ message: 'Order deleted successfully.' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: error.message });
    }
}