const db = require("../../config/db");



const getAllOrders = async (req, res) => {
    try {

        const userRole = req.user.user_type

        if (userRole != "super_admin") {
            return res.status(403).send({ success: false, message: "For getting all users order requires super admin role" })
        }

        const [orders] = await db.query(`
            SELECT * FROM orders ORDER BY created_at DESC
        `);

        return res.status(200).send({ success: true, orders });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}

module.exports = { getAllOrders }