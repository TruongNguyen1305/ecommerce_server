import Book from '../models/Book.js'

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
        const {publishFee} = req.body;
        const newBook = await Book.create({
            seller: user._id,
            ...req.body,
        });

        
        
        return res.status(201).json(newBook);
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