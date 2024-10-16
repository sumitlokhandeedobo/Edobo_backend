const express = require("express");
const { authenticateToken } = require("../../middleware/authenticate");
const {
  getAllOrders,
  updateOrderStatus,
} = require("../../controllers/admin/orderController");
const adminOrdersRouter = express();

adminOrdersRouter.get("/getAllOrders", authenticateToken, getAllOrders);

adminOrdersRouter.put(
  "/updateOrderStatus",
  authenticateToken,
  updateOrderStatus
);

module.exports = { adminOrdersRouter };
