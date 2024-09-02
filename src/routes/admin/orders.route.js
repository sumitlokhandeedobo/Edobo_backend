const express = require("express");
const { authenticateToken } = require("../../middleware/authenticate");
const { getAllOrders } = require("../../controllers/admin/orderController");
const adminOrdersRouter = express();


adminOrdersRouter.get('/getAllOrders', authenticateToken, getAllOrders)



module.exports = { adminOrdersRouter }

