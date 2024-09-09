const express = require("express");
const { authenticateToken } = require("../../middleware/authenticate");
const { getUserDetails, getUsersList, getSpecificUserDetails } = require("../../controllers/admin/userDetailsController");



const adminUserRouter = express()


adminUserRouter.get('/getAllUsers', authenticateToken, getUserDetails)

adminUserRouter.get('/getUsersList', authenticateToken, getUsersList)

adminUserRouter.get('/getUserDetails/:userId', authenticateToken, getSpecificUserDetails)


module.exports = adminUserRouter


