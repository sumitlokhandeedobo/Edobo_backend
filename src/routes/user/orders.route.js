const express = require("express");
const { orderProduct, orderList, cancelOrder } = require("../../controllers/user/orderController");
const { authenticateToken } = require("../../middleware/authenticate");
const ordersRouter = express();



ordersRouter.post('/order-place', authenticateToken, orderProduct)

ordersRouter.get('/order-list', authenticateToken, orderList)

ordersRouter.put('/cancel-order', authenticateToken, cancelOrder)


module.exports = { ordersRouter }