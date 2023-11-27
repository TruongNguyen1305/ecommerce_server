import UserRouter from './users.js'
import BookRouter from './books.js';
function route(app) {
    app.use('/api/users', UserRouter);
    app.use('/api/books', BookRouter);
}

export default route;
