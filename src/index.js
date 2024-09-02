const express = require('express');
const { ordersRouter } = require('./routes/user/orders.route');
const { adminOrdersRouter } = require('./routes/admin/orders.route');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

app.use('/user', ordersRouter)

app.use('/admin', adminOrdersRouter)

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
