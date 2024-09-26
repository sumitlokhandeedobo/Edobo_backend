const db = require("../../config/db");


const getDashboardData = async (req, res) => {
    try {
        const recentOrdersQuery = `
            SELECT total, email, created_at, payment_mode 
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 10;
        `;

        const productCountQuery = `
        SELECT COUNT(*) AS totalProducts 
        FROM products;`;

        // Query to get the total number of orders
        const orderCountQuery = `
        SELECT COUNT(*) AS totalOrders 
        FROM orders;`;

        // Query to get the total number of users
        const userCountQuery = `
        SELECT COUNT(*) AS totalUsers 
        FROM users;`;

        const [recentOrdersData, productCountData, orderCountData, userCountData] = await Promise.all([
            db.query(recentOrdersQuery),
            db.query(productCountQuery),
            db.query(orderCountQuery),
            db.query(userCountQuery)
        ]);

        
        // Ensure correct data access
        const productCount = productCountData[0][0].totalProducts;
        const orderCount = orderCountData[0][0].totalOrders;
        const userCount = userCountData[0][0].totalUsers;

        // Ensure recent orders are properly structured
        const recentOrders = recentOrdersData[0].map(order => ({
            total: order.total ? order.total : 0, // Replace null total with 0
            email: order.email,
            created_at: order.created_at,
            payment_mode: order.payment_mode
        }));

        // Return the data in the response
        return res.status(200).send({
            success: true,
            statistics: {
                totalProducts: productCount,
                totalOrders: orderCount,
                totalUsers: userCount
            },
            recentOrders
        });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}


module.exports = { getDashboardData }