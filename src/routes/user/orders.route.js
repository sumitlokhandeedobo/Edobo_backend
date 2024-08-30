const express = require("express");
const { orderProduct } = require("../../controllers/user/orderController");
const { authenticateToken } = require("../../middleware/authenticate");
const ordersRouter = express();



ordersRouter.post('/order-place',  authenticateToken , orderProduct)


module.exports = {ordersRouter}