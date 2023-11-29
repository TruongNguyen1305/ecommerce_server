import UserRouter from './users.js'
import BookRouter from './books.js';
import OrderRouter from './order.js';
function route(app) {
    app.use('/api/users', UserRouter);
    app.use('/api/books', BookRouter);
    app.use('/api/orders', OrderRouter);
}

export default route;
