import express from 'express';
import * as BookController from '../controllers/BookController.js'
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/').post(verifyToken, BookController.create).get(BookController.getAlls)
router.get('/me', verifyToken, BookController.getMyBooks)
router.post('/vnpay', verifyToken, BookController.getVnpayUrl)
router.get('/:id', BookController.get)
router.post('/pay', BookController.handlePayment)
router.delete('/:id', verifyToken, BookController.remove)
export default router;