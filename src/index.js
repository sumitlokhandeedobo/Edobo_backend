const express = require("express");
const { ordersRouter } = require("./routes/user/orders.route");
const { adminOrdersRouter } = require("./routes/admin/orders.route");
const multer = require("multer");
const { adminProductsRouter } = require("./routes/admin/products.route");
const adminUserRouter = require("./routes/admin/users.route");
const { dashboardRouter } = require("./routes/admin/dashboard.route");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(multer().any());
// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// Test API Endpoint
app.get("/test", (req, res) => {
  res.json({ message: "Node.js backend server is running successfullyyy!" });
});

app.get("/api/test", (req, res) => {
  res.json({
    message:
      "Test API is working!,Node.js backend server is running successfullyyy!",
  });
});
app.use("/user", ordersRouter);

app.use("/admin", adminOrdersRouter);
app.use("/admin", adminProductsRouter);
app.use("/admin", adminUserRouter);
app.use("/admin", dashboardRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
