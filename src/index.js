const express = require('express');
const db = require('./config/db');
const { default: axios } = require('axios');
const { ordersRouter } = require('./routes/user/orders.route');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());


// async function authenticateToken(req, res, next) {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];

//     if (!token) return res.sendStatus(401);

//     try {
//         // Validate token by making a request to the PHP backend
//         const response = await axios.get('http://127.0.0.1:8000/api/validate-token', {
//             headers: {
//                 'Authorization': `Bearer ${token}`
//             }
//         });

//         if (response.status === 200) {
//             req.user = response.data.user;
//             next();
//         } else {
//             res.sendStatus(response.status);
//         }
//     } catch (error) {
//         console.log(error.message);
//         res.sendStatus(403);
//     }
// }


// // Route to place an order
// app.post('/place-order', authenticateToken, async (req, res) => {
//     const {
//         invoice_no, transaction_id, payment_mode, store_id, customer_id,
//         firstname, lastname, email, phone_number, customer_shipping_addess,
//         customer_billing_address, customer_state, customer_city, area_name, pincode,
//         delivery_date, cancel_date, day_id, time_slot, delivery_type_id, delivery_charge,
//         wallet_amount, coupon_id, coupon_code, coupon_discount_amt, grand_total, comment,
//         products
//     } = req.body;

//     try {
//         // Insert order data
//         const [result] = await db.query(`
//             INSERT INTO orders (
//                 invoice_no, transaction_id, payment_mode, store_id, customer_id,
//                 firstname, lastname, email, phone_number, customer_shipping_addess,
//                 customer_billing_address, customer_state, customer_city, area_name, pincode,
//                 delivery_date, cancel_date, day_id, time_slot, delivery_type_id,
//                 delivery_charge, wallet_amount, coupon_id, coupon_code, coupon_discount_amt,
//                 grand_total, comment, created_at, updated_at
//             )
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?, NOW(), NOW())
//         `, [
//             invoice_no, transaction_id, payment_mode, store_id, customer_id,
//             firstname, lastname, email, phone_number, customer_shipping_addess,
//             customer_billing_address, customer_state, customer_city, area_name, pincode,
//             delivery_date, cancel_date, day_id, time_slot, delivery_type_id,
//             delivery_charge, wallet_amount, coupon_id, coupon_code, coupon_discount_amt,
//             grand_total, comment
//         ]);

//         const orderId = result.insertId;

//         // Insert products
//         for (const product of products) {
//             await db.query(`
//                 INSERT INTO order_products (order_id, product_id, order_status_id, name, quantity, price, total, tax, created_at)
//                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
//             `, [
//                 orderId, product.product_id, 1, product.name, product.quantity,
//                 product.price, product.total, product.tax
//             ]);
//         }

//         res.status(201).json({ message: 'Order placed successfully', orderId });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to place order' });
//     }
// });



// // Route to get all orders (for admin)
// app.get('/orders', authenticateToken, async (req, res) => {
//     try {
//         const [orders] = await db.query(`
//             SELECT * FROM orders ORDER BY created_at DESC
//         `);

//         res.json(orders);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Failed to retrieve orders' });
//     }
// });

app.use('/user',ordersRouter)

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
