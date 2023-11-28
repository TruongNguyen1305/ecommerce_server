import express from 'express';
import * as orderController from '../controllers/orderController.js'
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/create-order', verifyToken, orderController.createOrder)
router.delete('/remove/:id',verifyToken, orderController.removeOrder)
router.get('/myOrder', verifyToken, orderController.getOrderByUserId)
router.get('/', orderController.getAllOrders)


export default router;