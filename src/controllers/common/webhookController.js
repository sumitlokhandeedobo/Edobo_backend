const crypto = require("crypto");
const db = require("../../config/db");

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

const webhook = async (req, res) => {
  console.log("Webhook triggered");
  try {
    const { body } = req;
    //console.log("Received body:", body);
    const signature = req.headers["x-razorpay-signature"];
    //console.log("Signature:", signature);

    // Generate the signature using the Razorpay key secret
    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(body))
      .digest("hex");

    //console.log("generatedSignature--", generatedSignature);

    // Verify the webhook signature
    if (generatedSignature !== signature) {
      console.log("invalid signature");
      return res.status(400).send({
        success: false,
        message: "Invalid signature",
      });
    }

    //console.log("paymentEntioty---", body.payload.payment.entity);
    // Handle the payment event
    if (body.event === "payment.captured") {
      const paymentId = body.payload.payment.entity.id;
      const razorpayOrderId = body.payload.payment.entity.order_id;
      const amount = body.payload.payment.entity.amount;
      const notes = body.payload.payment.entity.notes; // Accessing the metadata
      console.log("notes--", notes);

      // Retrieve customerId, storeId, and cartItems from the metadata
      const customerId = notes.customerId;
      const storeId = notes.storeId;
      const cartItems = JSON.parse(notes.cartItems); // Parse the cart items string

      //console.log(`Payment captured: ${paymentId}, Razorpay Order ID: ${razorpayOrderId}, Amount: ${amount}`);
      //console.log(`Customer ID: ${customerId}, Store ID: ${storeId}, Cart Items:`, cartItems);

      // Create a new order in the database using this data
      const [[lastOrder]] = await db.query(
        "SELECT `id` FROM `orders` ORDER BY `id` DESC LIMIT 1"
      );
      const lastInvoiceID = lastOrder ? lastOrder.id : 0;
      const newInvoiceID = lastInvoiceID + 1;

      const newOrder = {
        invoice_no: `Inv${newInvoiceID}`,
        transaction_id: razorpayOrderId,
        payment_mode: "razorpay",
        store_id: storeId,
        customer_id: customerId,
        total: amount / 100, // Amount from Razorpay is in paise, convert to rupees
      };

      const [orderResult] = await db.query(
        "INSERT INTO `orders` SET ?",
        newOrder
      );
      const orderId = orderResult.insertId;

      // Insert cart items into order_products and update product quantity
      const orderPromises = cartItems.map(async (item) => {
        const orderProduct = {
          order_id: orderId,
          product_id: item.product_id,
          order_status_id: 1, // Assuming status 1 is 'ordered'
          name: item.product_name,
          quantity: item.qty,
          price: item.price,
          total: item.subtotal,
        };

        await db.query("INSERT INTO `order_products` SET ?", orderProduct);

        // Update product quantity in inventory
        await db.query(
          "UPDATE `products` SET `qty` = `qty` - ? WHERE `id` = ?",
          [item.qty, item.product_id]
        );
      });

      await Promise.all(orderPromises);

      console.log(`Order created successfully with ID: ${orderId}`);
      return res
        .status(200)
        .send({ success: true, message: "Order created successfully" });
    }

    if (body.event === "payment.failed") {
      const paymentError = body.payload.payment.entity.error_code;
      const errorDescription = body.payload.payment.entity.error_description;
      const razorpayOrderId = body.payload.payment.entity.order_id;

      // Log or store the error details in your system
      console.log(`Payment failed for Order ID: ${razorpayOrderId}`);
      console.log(
        `Error Code: ${paymentError}, Description: ${errorDescription}`
      );

      // Optionally, you can notify the user or save this information to the database
      return res.status(200).send({
        success: false,
        message: `Payment failed. Error Code: ${paymentError}, Description: ${errorDescription}`,
      });
    }

    res.status(200).send({ success: true });
  } catch (error) {
    console.log("errror", error.message);
    return res.status(500).send({ success: false, message: error.message });
  }
};

module.exports = { webhook };
