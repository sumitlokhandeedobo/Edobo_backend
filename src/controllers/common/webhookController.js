const crypto = require('crypto')

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;


const webhook = async (req, res) => {
    console.log("Webhook triggered");
    try {
        const { body } = req;
        console.log("Received body:", body);
        const signature = req.headers['x-razorpay-signature'];
        console.log("Signature:", signature);
        
        // Generate the signature using the Razorpay key secret
        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(JSON.stringify(body))
            .digest('hex');

        console.log("generatedSignature--", generatedSignature);


        // Verify the webhook signature
        if (generatedSignature !== signature) {
            return res.status(400).send({
                success: false,
                message: "Invalid signature"
            });
        }

        // Handle the payment event
        if (body.event === 'payment.captured') {
            const paymentId = body.payload.payment.entity.id;
            // Update your database or perform other actions as necessary
            console.log(`Payment captured: ${paymentId}`);
        }

        res.status(200).send({ success: true });
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}

module.exports = { webhook }