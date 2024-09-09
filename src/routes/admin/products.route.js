const express = require("express");
const { authenticateToken } = require("../../middleware/authenticate");
const { bulkProductUpload } = require("../../controllers/admin/productController");

const adminProductsRouter = express();


adminProductsRouter.post('/bulkUploadProduct', authenticateToken, bulkProductUpload)


module.exports = { adminProductsRouter }