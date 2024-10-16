const express = require("express");
const {
  orderProduct,
  orderList,
  cancelOrder,
  orderStatus,
  getDeliveryTimeSlot,
} = require("../../controllers/user/orderController");
const { authenticateToken } = require("../../middleware/authenticate");
const ordersRouter = express();
// const express = require("express");
const router = express.Router();

// Example route: /api/user
router.get("/user", (req, res) => {
  res.status(200).json({ message: "User endpoint works!" });
});

module.exports = { ordersRouter: router };

ordersRouter.post("/order-place", authenticateToken, orderProduct);

ordersRouter.get("/order-list", authenticateToken, orderList);

ordersRouter.put("/cancel-order", authenticateToken, cancelOrder);

ordersRouter.get("/order-status", authenticateToken, orderStatus);

ordersRouter.get("/deliveryTimeSlots", authenticateToken, getDeliveryTimeSlot);

module.exports = { ordersRouter };
