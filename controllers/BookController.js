import Book from '../models/Book.js';
import {createHmac} from 'crypto';
import fetch from 'node-fetch';
import dateFormat from 'dateformat';
import qs from "qs"

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
        const data = JSON.parse(Buffer.from(extraData, "base64").toString());
        if(resultCode === 0) {
            const book = await Book.findByIdAndUpdate(data.id, {
                isSelling: true
            }, {
                new: true
            });
            console.log(book);
        }
        else {
            const book = await Book.findByIdAndDelete(data.id);
            console.log(book);
        }
        
        return res.status(200).json("OK");
    } catch (error) {
        console.log(error);
        return next(error);
    }
}

//[GET] /api/books/vnpay
export const getVnpayUrl = async (req, res, next) => {
    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    console.log(ipAddr)

    
    let tmnCode = process.env.vnp_TmnCode;
    let secretKey = process.env.vnp_HashSecret;
    let vnpUrl = process.env.vnp_Url;
    let returnUrl = process.env.vnp_ReturnUrl;

    let date = new Date();

    let createDate = dateFormat(date, 'yyyymmddHHmmss');
    let orderId = dateFormat(date, 'HHmmss');
    let amount = req.body.amount;
    let bankCode = req.body.bankCode;
    
    let orderInfo = req.body.orderDescription;
    // let orderType = req.body.orderType;
    let locale = req.body.language;
    if(locale === null || locale === ''){
        locale = 'vn';
    }
    let currCode = 'VND';
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    // vnp_Params['vnp_Merchant'] = ''
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = orderInfo;
    // vnp_Params['vnp_OrderType'] = orderType;
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    if(bankCode !== null && bankCode !== ''){
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    // vnp_Params = sortObject(vnp_Params);

    let signData = qs.stringify(vnp_Params, { encode: false });   
    let hmac = createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    res.status(200).json(vnpUrl)
}