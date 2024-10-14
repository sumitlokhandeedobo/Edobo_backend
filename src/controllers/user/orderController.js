const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db')
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_API_KEY_ID,
    key_secret: process.env.RAZORPAY_API_SECRET
});


// const orderProduct = async (req, res) => {
//     try {
//         const customerId = req.body.customer_id;
//         const loggedInUserId = req.user.id

//         if (customerId !== loggedInUserId) {
//             return res.status(403).send({
//                 success: false,
//                 message: "Unauthorized: You cannot place orders for other users"
//             });
//         }

//         const [cartItems] = await db.query('SELECT * FROM `carts` WHERE `customer_id` = ?', [customerId]);

//         if (cartItems.length === 0) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Your cart is empty"
//             });
//         }
//         console.log("cartItems--", cartItems);

//         const totalAmount = cartItems.reduce((total, item) => total + item.subtotal, 0);

//         console.log("totalAmount", totalAmount);

//         const [[lastOrder]] = await db.query('SELECT `id` FROM `orders` ORDER BY `id` DESC LIMIT 1');
//         const lastInvoiceID = lastOrder ? lastOrder.id : 0;
//         const newInvoiceID = lastInvoiceID + 1;

//         const receipt = `receipt#${newInvoiceID}`.slice(0, 40);

//         const razorpayOrder = await razorpay.orders.create({
//             amount: totalAmount * 100, // amount in paise
//             currency: 'INR',
//             receipt: receipt,
//             payment_capture: 1 // auto capture
//         });
//         console.log("razorpayOrder", razorpayOrder);

//         // If the Razorpay order creation fails
//         if (!razorpayOrder || !razorpayOrder.id) {
//             return res.status(500).send({
//                 success: false,
//                 message: "Error creating Razorpay order"
//             });
//         }

//         /*
//         for (let item of cartItems) {
//             const [[product]] = await db.query('SELECT `qty` FROM `products` WHERE `id` = ?', [item.product_id]);
//             if (product.qty < item.qty) {
//                 return res.status(400).send({
//                     success: false,
//                     message: `Insufficient quantity for product ID: ${item.product_id}`
//                 });
//             }
//         }

//         // Create a new order
//         const newOrder = {
//             invoice_no: `Inv${newInvoiceID}`,
//             transaction_id: razorpayOrder.id,
//             payment_mode: req.body.payment_mode,
//             store_id: req.body.store_id,
//             customer_id: customerId,
//             firstname: req.body.firstname,
//             order_status_id: req.body.order_status_id,
//             lastname: req.body.lastname,
//             email: req.body.email,
//             phone_number: req.body.phone_number,
//             customer_shipping_addess: req.body.shipping_address,
//             customer_city: req.body.shipping_city,
//             pincode: req.body.shipping_postcode,
//             day_id: req.body.day_id,
//             time_slot: req.body.time_slot,
//             total: req.body.total,
//             delivery_type_id: req.body.delivery_type_id
//         };

//         const [orderResult] = await db.query('INSERT INTO `orders` SET ?', newOrder);
//         const orderId = orderResult.insertId;

//         // Process each item in the cart
//         const orderPromises = cartItems.map(async (item) => {
//             const orderProduct = {
//                 order_id: orderId,
//                 product_id: item.product_id,
//                 order_status_id: req.body.order_status_id,
//                 name: item.product_id,
//                 quantity: item.qty,
//                 price: item.subtotal,
//                 total: item.subtotal,
//                 tax: item.igst || 0
//             };

//             await db.query('INSERT INTO `order_products` SET ?', orderProduct);

//             // Update product quantity in the database
//             await db.query('UPDATE `products` SET `qty` = `qty` - ? WHERE `id` = ?', [item.qty, item.product_id]);

//             await db.query('DELETE FROM `carts` WHERE `customer_id` = ? AND `product_id` = ?', [customerId, item.product_id]);
//         });

//         await Promise.all(orderPromises);
//         */

//         res.status(200).send({
//             success: true,
//             message: 'Order created successfully',
//             // result: {
//             //     id: orderId,
//             razorpayOrderId: razorpayOrder.id,
//             // amount: totalAmount 
//         });

//     } catch (error) {
//         console.log(error);
//         return res.status(500).send({ success: false, message: error.message })
//     }
// }

const orderProduct = async (req, res) => {
    try {
        const customerId = req.body.customer_id;
        const loggedInUserId = req.user.id;

        if (customerId !== loggedInUserId) {
            return res.status(403).send({
                success: false,
                message: "Unauthorized: You cannot place orders for other users"
            });
        }

        const [cartItems] = await db.query('SELECT * FROM `carts` WHERE `customer_id` = ?', [customerId]);

        if (cartItems.length === 0) {
            return res.status(400).send({
                success: false,
                message: "Your cart is empty"
            });
        }

        console.log("cartItems--", cartItems);

        const totalAmount = cartItems.reduce((total, item) => total + item.subtotal, 0);
        console.log("totalAmount", totalAmount);

        const [[lastOrder]] = await db.query('SELECT `id` FROM `orders` ORDER BY `id` DESC LIMIT 1');
        const lastInvoiceID = lastOrder ? lastOrder.id : 0;
        const newInvoiceID = lastInvoiceID + 1;
        const receipt = `receipt#${newInvoiceID}`.slice(0, 40);

        // Check if payment mode is Cash on Delivery (COD)
        if (req.body.payment_mode === 'Cash on delivery') {
            // Handle Cash on Delivery order creation logic here

            const newOrder = {
                invoice_no: `Inv${newInvoiceID}`,
                transaction_id: null,  // No transaction ID for COD
                payment_mode: req.body.payment_mode, // Cash on Delivery
                store_id: req.body.store_id,
                customer_id: customerId,
                firstname: req.body.firstname,
                order_status_id: req.body.order_status_id,
                lastname: req.body.lastname,
                email: req.body.email,
                phone_number: req.body.phone_number,
                customer_shipping_addess: req.body.shipping_address,
                customer_city: req.body.shipping_city,
                pincode: req.body.shipping_postcode,
                day_id: req.body.day_id,
                time_slot: req.body.time_slot,
                total: totalAmount,
                delivery_type_id: req.body.delivery_type_id
            };

            const [orderResult] = await db.query('INSERT INTO `orders` SET ?', newOrder);
            const orderId = orderResult.insertId;

            // Process each item in the cart
            const orderPromises = cartItems.map(async (item) => {
                const orderProduct = {
                    order_id: orderId,
                    product_id: item.product_id,
                    order_status_id: req.body.order_status_id,
                    name: item.product_id,
                    quantity: item.qty,
                    price: item.subtotal,
                    total: item.subtotal,
                    tax: item.igst || 0
                };

                await db.query('INSERT INTO `order_products` SET ?', orderProduct);

                // Update product quantity in the database
                await db.query('UPDATE `products` SET `qty` = `qty` - ? WHERE `id` = ?', [item.qty, item.product_id]);

                // Remove the item from the cart
                await db.query('DELETE FROM `carts` WHERE `customer_id` = ? AND `product_id` = ?', [customerId, item.product_id]);
            });

            await Promise.all(orderPromises);

            return res.status(200).send({
                success: true,
                message: 'Order created successfully (Cash on Delivery)',
                orderId: orderId
            });

        } else {
            // Handle online payment (Razorpay) flow
            const razorpayOrder = await razorpay.orders.create({
                amount: totalAmount * 100, // amount in paise
                currency: 'INR',
                receipt: receipt,
                payment_capture: 1 // auto capture
            });
            console.log("razorpayOrder", razorpayOrder);

            // If the Razorpay order creation fails
            if (!razorpayOrder || !razorpayOrder.id) {
                return res.status(500).send({
                    success: false,
                    message: "Error creating Razorpay order"
                });
            }

            res.status(200).send({
                success: true,
                message: 'Order created successfully (Online Payment)',
                razorpayOrderId: razorpayOrder.id,
            });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).send({ success: false, message: error.message });
    }
};


const orderList = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        console.log(loggedInUserId);

        const [orders] = await db.query(
            'SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 5',
            [loggedInUserId]
        );
        console.log(orders);

        return res.status(200).send({ success: true, data: orders });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.body.order_id;
        const loggedInUserId = req.user.id;

        // Retrieve the order to ensure it belongs to the logged-in user and is not already canceled
        const [[order]] = await db.query('SELECT * FROM `orders` WHERE `id` = ? AND `customer_id` = ?', [orderId, loggedInUserId]);

        if (!order) {
            return res.status(404).send({
                success: false,
                message: "Order not found or you are not authorized to cancel this order"
            });
        }

        if (order.order_status_id === 5) {
            return res.status(400).send({
                success: false,
                message: "This order has already been canceled"
            });
        }

        // Update the order status to "Canceled" and set the cancellation date
        await db.query('UPDATE `orders` SET `order_status_id` = ?, `cancel_date` = NOW() WHERE `id` = ?', [5, orderId]);

        // Optionally, handle restocking of the products if necessary
        const [orderProducts] = await db.query('SELECT * FROM `order_products` WHERE `order_id` = ?', [orderId]);

        const restockPromises = orderProducts.map(async (product) => {
            await db.query('UPDATE `products` SET `qty` = `qty` + ? WHERE `id` = ?', [product.quantity, product.product_id]);
        });

        await Promise.all(restockPromises);

        res.status(200).send({
            success: true,
            message: 'Order canceled successfully'
        });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
}

const orderStatus = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        const orderId = req.query.orderId;

        const [orderRows] = await db.query('SELECT * FROM orders WHERE id = ? AND customer_id = ?', [orderId, loggedInUserId])

        if (orderRows.length === 0) {
            return res.status(404).send({ success: false, message: 'Order not found or you do not have permission to view this order.' });
        }

        const order = orderRows[0];
        const [statusRows] = await db.query('SELECT * FROM order_statuses WHERE id = ?', [order.order_status_id]);

        if (statusRows.length === 0) {
            return res.status(404).send({ success: false, message: 'Order status not found.' });
        }

        const status = statusRows[0];

        // Combine order details and status
        const result = {
            order: { ...order },
            status: { ...status }
        };

        return res.status(200).send({ success: true, data: result });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
}

const getDeliveryTimeSlot = async (req, res) => {
    try {
        const { delivery_name, substore_id } = req.query;

        if (!delivery_name || !substore_id) {
            return res.status(400).send({ success: false, message: 'delivery_name and substore_id are required' });
        }

        const deliveryTypeQuery = `
            SELECT id as delivery_types_id FROM delivery_type_masters 
            WHERE delivery_name = ? AND FIND_IN_SET(?, substore_id) AND status = 'active'
        `;

        const [deliveryTypeResults] = await db.query(deliveryTypeQuery, [delivery_name, substore_id])

        if (deliveryTypeResults.length === 0) {
            return res.status(404).send({ success: false, message: 'Delivery type not found' });
        }

        const delivery_types_id = deliveryTypeResults[0].delivery_types_id;

        const timeSlotsQuery = `
            SELECT day, start_time, end_time, cut_off, order_limit 
            FROM delivery_time_slots 
            WHERE delivery_type_masters_id = ? AND status = '1'
        `;

        const [timeSlotsResults] = await db.query(timeSlotsQuery, [delivery_types_id]);

        if (timeSlotsResults.length === 0) {
            return res.status(404).send({ success: false, message: 'No time slots available' });
        }

        return res.status(200).send({ success: true, message: 'Time slots fetched successfully', data: timeSlotsResults });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message });
    }
};



module.exports = { orderProduct, orderList, cancelOrder, orderStatus, getDeliveryTimeSlot }
