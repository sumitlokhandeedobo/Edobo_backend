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

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, newStatusId } = req.body;
        const userRole = req.user.user_type

        if (userRole != "super_admin") {
            return res.status(403).send({ success: false, message: "For updating  user order status requires super admin role" })
        }

        if (!orderId || !newStatusId) {
            return res.status(400).send({ success: false, message: "Order ID and new status ID are required" });
        }

        // Update order status
        const [result] = await db.query('UPDATE orders SET order_status_id = ? WHERE id = ?', [newStatusId, orderId]);

        if (result.affectedRows === 0) {
            return res.status(404).send({ success: false, message: "Order not found or status not updated" });
        }

        return res.status(200).send({ success: true, message: "Order status updated successfully" });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}


module.exports = { getAllOrders, updateOrderStatus }