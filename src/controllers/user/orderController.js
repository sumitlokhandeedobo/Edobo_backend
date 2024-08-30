const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db')


const orderProduct = async(req,res)=>{
    try {
        const customerId = req.body.customer_id;
        const loggedInUserId = req.user.id

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

        const [[lastOrder]] = await db.query('SELECT `id` FROM `orders` ORDER BY `id` DESC LIMIT 1');
        const lastInvoiceID = lastOrder ? lastOrder.id : 0;
        const newInvoiceID = lastInvoiceID + 1;

        // Create a new order
        const newOrder = {
            invoice_no: `Inv${newInvoiceID}`,
            transaction_id: uuidv4(),
            payment_mode: req.body.payment_mode,
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
            total: req.body.total,
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
                name: item.product_id, // Adjust if necessary
                quantity: item.qty,
                price: item.subtotal,
                total: item.subtotal,
                tax: item.igst || 0
            };

            await db.query('INSERT INTO `order_products` SET ?', orderProduct);
            await db.query('DELETE FROM `carts` WHERE `customer_id` = ? AND `product_id` = ?', [customerId, item.product_id]);
        });

        await Promise.all(orderPromises);

        res.status(200).send({
            success: true,
            message: 'Order placed successfully',
            result: { id: orderId }
        });
        
    } catch (error) {
        return res.status(500).send({success:false,message:error.message})
    }
}

module.exports = {orderProduct}