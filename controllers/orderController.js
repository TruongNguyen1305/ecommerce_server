import Order from "../models/Order.js";
import Book from "../models/Book.js";
import { createHmac } from "crypto";
import fetch from "node-fetch";

//trả sau
export const createOrder = async (req, res, next) => {
  try {
    const book = await Book.findById(req.body.book);
    if (book) {
      if (book.isSelling === false) {
        return res.status(404).json("The book has been sold");
      }
      const user = req.user;
      const delivery = await createShippingOrder(book, req.body, true);
      console.log(delivery);
      const newOrder = await Order.create({
        buyer: user._id,
        ...req.body,
        shippingCode: delivery.order_code,
        deliveryFee: Number(delivery.total_fee),
      });
      await Book.updateOne({ _id: req.body.book }, { $set: { isSelling: false } });
      return res.status(200).json({ message: "Order created successfully", order: newOrder });
    } else {
      console.log("Book not found");
      return res.status(404).json({ error: "Book not found" });
    }
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};

//trả trước
export const payOrder = async (req, res, next) => {
  try {
    const book = await Book.findById(req.body.book);
    if (book) {
      if (book.isSelling === false) {
        return res.status(404).json("The book has been sold");
      }
      const user = req.user;
      const partnerCode = process.env.PARTNER_CODE;
      const accessKey = process.env.ACCESS_KEY;
      const secretkey = process.env.SECRET_KEY;
      const lang = "vi";
      const requestType = "linkWallet";
      const orderInfo = "Thanh toán qua ví MoMo";
      const ipnUrl = process.env.IPN_URL_ORDER;
      const redirectUrl = process.env.REDIRECT_URL_ORDER;
      const partnerClientId = process.env.PARTNER_CLIENT_ID;

      const data = {
        buyer: user._id.toString(),
        ...req.body,
      };
      const deliveryFee = req.body.deliveryFee || 0;
      const extraData = Buffer.from(JSON.stringify(data)).toString("base64");
      const requestId = user._id.toString() + new Date().getTime();
      const rawSignature =
        "accessKey=" +
        accessKey +
        "&amount=" +
        (book.price + deliveryFee) +
        "&extraData=" +
        extraData +
        "&ipnUrl=" +
        ipnUrl +
        "&orderId=" +
        requestId +
        "&orderInfo=" +
        orderInfo +
        "&partnerClientId=" +
        partnerClientId +
        "&partnerCode=" +
        partnerCode +
        "&redirectUrl=" +
        redirectUrl +
        "&requestId=" +
        requestId +
        "&requestType=" +
        requestType;

      const signature = createHmac("sha256", secretkey).update(rawSignature).digest("hex");

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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });
      return res.status(200).json(await response.json());
    } else {
      console.log("Book not found");
      return res.status(404).json({ error: "Book not found" });
    }
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find();
    return res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getOrderByUserId = async (req, res, next) => {
  try {
    const user = req.user;
    const orders = await Order.find({
      $or: [
        { buyer: user._id },
        {
          book: {
            $in: (await Book.find({ seller: user._id })).map((b) => b._id.toString()),
          },
        },
      ],
    }).populate("book");
    return res.status(200).json(orders);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const getOrderDetail = async (req, res, next) => {
  try {
    const user = req.user;
    const order = await Order.findById(req.params.id).populate("book");
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (user._id.toString() !== order.buyer.toString() && user._id.toString() !== order.book.seller.toString()) {
      return res.status(403).json({ error: "Permission denied" });
    }
    return res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//Người bán chấp nhận đơn hàng, cập nhập status đơn hàng
export const updateOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const order = await Order.findById(req.params.id).populate({
      path: "book",
      populate: {
        path: "seller",
      },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.book.seller._id.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Permission denied" });
    }
    if (order.status !== "preparing") {
      return res.status(400).json({ error: "Order has been prepared" });
    }
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "prepared",
        },
      },
      {
        new: true,
      }
    );
    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const removeOrder = async (req, res, next) => {
  try {
    const user = req.user;
    const orderId = req.params.id;
    const orderToDelete = await Order.findById(orderId).populate("book", "seller");
    if (!orderToDelete) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (
      user._id.toString() !== orderToDelete.buyer.toString() &&
      user._id.toString() !== orderToDelete.book.seller.toString()
    ) {
      return res.status(403).json({ error: "Permission denied" });
    }
    if (orderToDelete.status !== "preparing") {
      return res.status(403).json({ error: "Order is prepared" });
    }
    const bookId = orderToDelete.book;
    await Book.updateOne({ _id: bookId }, { $set: { isSelling: true } });
    await orderToDelete.remove();
    return res.status(200).json({ message: "Order deleted successfully." });
  } catch (error) {
    console.error("Error deleting order:", error);
    return res.status(500).json({ error: error.message });
  }
};

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
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = req.body;

    /**
     * verify signature
     *
     *
     */
    const data = JSON.parse(Buffer.from(extraData, "base64").toString());
    console.log(data);
    if (resultCode === 0) {
      const book = await Book.findByIdAndUpdate(
        data.book,
        {
          isSelling: false,
        },
        {
          new: true,
        }
      );

      const delivery = await createShippingOrder(book, data, false);
      const newOrder = await Order.create({
        ...data,
        shippingCode: delivery.order_code,
        deliveryFee: Number(delivery.total_fee),
      });

      console.log("Thanfh cong");
    } else {
      console.log(`Thanh toán thất bại, resultCode: ${resultCode}`);
    }

    return res.status(200).json("OK");
  } catch (error) {
    console.log(error);
    return next(error);
  }
};

const createShippingOrder = async (book, order, cod) => {
  try {
    const response = await fetch("https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Token: "914368f7-8f98-11ee-b1d4-92b443b7a897",
      },
      body: JSON.stringify({
        payment_type_id: 2,
        note: "Đơn hàng của BKBook",
        required_note: "CHOXEMHANGKHONGTHU",
        from_name: book.userName,
        from_phone: book.phone,
        from_address: `${book.address}, ${book.ward.split("//")[0]}, ${book.district.split("//")[0]}, ${
          book.province.split("//")[0]
        }, Vietnam `,
        from_ward_name: book.ward.split("//")[0],
        from_district_name: book.district.split("//")[0],
        from_province_name: book.province.split("//")[0],
        return_phone: book.userName,
        return_address: `${book.address}, ${book.ward.split("//")[0]}, ${book.district.split("//")[0]}, ${
          book.province.split("//")[0]
        }, Vietnam `,
        return_district_id: null,
        return_ward_code: "",
        client_order_code: "",
        to_name: order.name,
        to_phone: order.phone,
        to_address: `${order.address}, ${order.ward.split("//")[0]}, ${order.district.split("//")[0]}, ${
          order.province.split("//")[0]
        }, Vietnam `,
        to_ward_code: String(order.ward.split("//")[1]),
        to_district_id: 1444,
        cod_amount: cod ? book.price : 0,
        content: "Theo New York Times",
        weight: 1,
        length: 1,
        width: 1,
        height: 1,
        pick_station_id: 1444,
        deliver_station_id: null,
        insurance_value: 10000,
        service_id: 0,
        service_type_id: 2,
        coupon: null,
        pick_shift: [2],
        items: [
          {
            name: book.name,
            code: "BKBook2023",
            quantity: 1,
            price: book.price,
            length: 1,
            width: 1,
            height: 1,
            weight: 100,
          },
        ],
      }),
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.log(error);
    next(error);
  }
};
