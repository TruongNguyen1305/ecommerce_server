import Book from '../models/Book.js';
import {createHmac} from 'crypto';
import fetch from 'node-fetch';

// [GET] /api/books
export const getAlls = (req, res, next) =>{
    const {genre, name, num} = req.query;
    let query = {
        isSelling: true
    }
    if(genre) {
        query.genre = genre;
    }
    if(name) {
        query.$text = {
            $search: name
        }
    }
    Book.find(query).sort({publishFee: -1}).limit(parseInt(num))
        .then(books => res.status(200).json(books))
        .catch(next)
}

// [GET] /api/books/:id
export const get = async (req, res, next) =>{
    try {
        const book = await Book.findById(req.params.id);
        if(!book) {
            res.status(404);
            return next(new Error("Book not found"));
        }
        return res.status(200).json(book);
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

// [GET] /api/books/me
export const getMyBooks = async (req, res, next) =>{
    try {
        const {isSelling} = req.query;
        const user = req.user;
        const query = {
            seller: user._id,
        }
        if(isSelling !== undefined) {
            query.isSelling = isSelling === "true";
        }
        const books = await Book.find(query);
        
        return res.status(200).json(books);
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

//[POST] /api/books
export const create = async (req,res, next) => {
    try {
        const user = req.user;
        const newBook = await Book.create({
            seller: user._id,
            ...req.body,
        });

        const partnerCode = process.env.PARTNER_CODE;
        const accessKey = process.env.ACCESS_KEY;
        const secretkey = process.env.SECRET_KEY;
        const lang = 'vi';
        const requestType = 'linkWallet';
        const orderInfo = 'Thanh toán qua ví MoMo';
        const ipnUrl = process.env.IPN_URL;
        const redirectUrl = process.env.REDIRECT_URL;
        const partnerClientId = process.env.PARTNER_CLIENT_ID;

        const data = {
            id: newBook._id.toString()
        }
        const extraData = Buffer.from(JSON.stringify(data)).toString("base64"); 
        const requestId = user._id.toString() + new Date().getTime();
        const rawSignature = "accessKey=" + accessKey + "&amount=" + newBook.publishFee + "&extraData=" + 
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
            amount: newBook.publishFee,
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
        return res.status(200).json({
            book: newBook,
            payment: await response.json()
        })
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

//[DELETE] /api/books/:id
export const remove = async (req, res, next) => {
    try {
        const user = req.user;

        const book = await Book.findById(req.params.id);

        if(!book) {
            res.status(404);
            return next(new Error('Book not found'));
        }

        if(book.seller.toString() !== user._id.toString()) {
            res.status(403);
            return next(new Error('Permission denied'));
        }
        
        await book.deleteOne();
        
        return res.status(200).json(book);
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

//[POST] /api/books/pay
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
        
        if(resultCode === 0) {
            const data = JSON.parse(Buffer.from(extraData, "base64").toString());
            const book = await Book.findByIdAndUpdate(data.id, {
                isSelling: true
            }, {
                new: true
            });
            console.log(book);
        }
        
        return res.status(200).json("OK");
    } catch (error) {
        console.log(error);
        return next(error);
    }
}