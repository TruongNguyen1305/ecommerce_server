import Order from '../models/Order.js'
import Book from '../models/Book.js'
import {createHmac} from 'crypto';
import fetch from 'node-fetch';

//trả sau
export const createOrder = async (req, res, next) => {
    try {
        const book = await Book.findById(req.body.book);
        if (book) {
            if (book.isSelling === false) {
                return res.status(404).json('The book has been sold');
            }
            const user = req.user;
            const newOrder = await Order.create({
                buyer: user._id,
                ...req.body,
            });
            await Book.updateOne({ _id: req.body.book }, { $set: { isSelling: false } });
            return res.status(200).json({ message: "Order created successfully", order: newOrder });
        } else {
            console.log('Book not found');
            return res.status(404).json({ error: 'Book not found' });
        }
    } catch (error) {
        console.log(error.message);
        res.status(400).json({ error: error.message });
    }
}

//trả trước
export const payOrder = async (req, res, next) => {
    try {
        const book = await Book.findById(req.body.book);
        if (book) {
            if (book.isSelling === false) {
                return res.status(404).json('The book has been sold');
            }
            const user = req.user;
            const partnerCode = process.env.PARTNER_CODE;
            const accessKey = process.env.ACCESS_KEY;
            const secretkey = process.env.SECRET_KEY;
            const lang = 'vi';
            const requestType = 'linkWallet';
            const orderInfo = 'Thanh toán qua ví MoMo';
            const ipnUrl = process.env.IPN_URL_ORDER;
            const redirectUrl = process.env.REDIRECT_URL;
            const partnerClientId = process.env.PARTNER_CLIENT_ID;
            
            const data = {
                buyer: user._id.toString(),
                ...req.body
            }
            const deliveryFee = req.body.deliveryFee || 0;
            const extraData = Buffer.from(JSON.stringify(data)).toString("base64"); 
            const requestId = user._id.toString() + new Date().getTime();
            const rawSignature = "accessKey=" + accessKey + "&amount=" + (book.price + deliveryFee)  + "&extraData=" + 
                                extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + 
                                requestId + "&orderInfo=" + orderInfo + "&partnerClientId=" + partnerClientId + "&partnerCode=" + 
                                partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + 
                                requestId + "&requestType=" + requestType;
            
            const signature = createHmac('sha256', secretkey)
                .update(rawSignature)
                .digest('hex');
        
            const requestBody = JSON.stringify({
                partnerCode: partnerCode,
                partnerClientId: partnerClientId,
                requestId: requestId,
                amount: book.price + deliveryFee,
                orderId: requestId,
                orderInfo: orderInfo,
                redirectUrl: redirectUrl,
                ipnUrl: ipnUrl,
                requestType: requestType,
                extraData: extraData,
                lang: lang,
                signature: signature,
            });
        
            const response = await fetch("https://test-payment.momo.vn/v2/gateway/api/create", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: requestBody
            });
            return res.status(200).json(await response.json())
            
        } else {
            console.log('Book not found');
            return res.status(404).json({ error: 'Book not found' });
        }
    } catch (error) {
        console.log(error.message);
        res.status(400).json({ error: error.message });
    }
}

export const getAllOrders = async (req, res, next) => {
    try {
        const orders = await Order.find();
        return res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getOrderByUserId = async (req, res, next) => {
    try {
        const user = req.user;
        const orders = await Order.find({ 
            $or: [
                {buyer: user._id},
                {book: {
                    $in: (await Book.find({seller: user._id})).map(b => b._id.toString())
                }}
            ]
         });
        return res.status(200).json(orders);
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ error: error.message });
    }
}

export const getOrderDetail = async (req, res, next) => {
    try {
        const user = req.user;
        const order = await Order.findById(req.params.id);
        if(!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const book = await Book.findById(order.book);
        if(user._id.toString() !== order.buyer.toString() && user._id.toString() !== book.seller.toString()) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        return res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

//Người bán chấp nhận đơn hàng, cập nhập status đơn hàng
export const updateOrder = async (req, res, next) => {
    try {
        const user = req.user;
        const order = await Order.findById(req.params.id).populate({
            path: "book",
            populate: {
                path: "seller"
            },
        });
        if(!order) {
            return res.status(404).json({ error: 'Order not found' })
        }
        if(order.book.seller._id.toString() !== user._id.toString()) {
            return res.status(403).json({ error: 'Permission denied' })
        }
        if(order.status !== "preparing") {
            return res.status(400).json({ error: 'Order has been prepared' })
        }
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, {
            $set: {
                status: "prepared"
            }
        }, {
            new: true
        })
        return res.status(200).json(updatedOrder);
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ error: error.message });
    }
}

export const removeOrder = async (req, res, next) => {
    try {
        const user = req.user;
        const orderId = req.params.id;
        const orderToDelete = await Order.findById(orderId).populate("book", "seller");
        if (!orderToDelete) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (user._id.toString() !== orderToDelete.buyer.toString() && user._id.toString() !== orderToDelete.book.seller.toString()) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        if (orderToDelete.status !== "preparing") {
            return res.status(403).json({ error: 'Order is prepared' });
        }
        const bookId = orderToDelete.book;
        await Book.updateOne({ _id: bookId }, { $set: { isSelling: true } });
        await orderToDelete.remove();
        return res.status(200).json({ message: 'Order deleted successfully.' });
    } catch (error) {
        console.error('Error deleting order:', error);
        return res.status(500).json({ error: error.message });
    }
}

//[POST] /api/orders/notify_payment
export const handlePayment = async (req, res, next) => {
    try {
        const accessKey = process.env.ACCESS_KEY;
        const secretkey = process.env.SECRET_KEY;

        const {
            partnerCode,
            orderId,
            requestId,
            amount,
            orderInfo,
            orderType,
            transId ,
            resultCode,
            message,
            payType,
            responseTime,
            extraData,
            signature,
        } = req.body

        /**
         * verify signature
         * 
         * 
         */
        const data = JSON.parse(Buffer.from(extraData, "base64").toString());
        if(resultCode === 0) {
            const book = await Book.findByIdAndUpdate(data.book, {
                isSelling: false
            }, {
                new: true
            });

            const order = await Order.create(data)
            console.log(book);
            console.log(order);
        }
        else {
            console.log(`Thanh toán thất bại, resultCode: ${resultCode}`)
        }
        
        return res.status(200).json("OK");
    } catch (error) {
        console.log(error);
        return next(error);
    }
}