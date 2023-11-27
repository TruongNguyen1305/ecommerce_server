import express from 'express';
import * as BookController from '../controllers/BookController.js'
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/').post(verifyToken, BookController.create).get(BookController.getAlls)
router.get('/:id', BookController.get)
router.delete('/:id', verifyToken, BookController.remove)
router.get('/me', verifyToken, BookController.getMyBooks)

export default router;