const express = require("express");
const { getDashboardData } = require("../../controllers/admin/dashboardController");

const dashboardRouter = express();



dashboardRouter.get('/dashboard', getDashboardData)


module.exports = { dashboardRouter }