const db = require("../../config/db");



const getAllOrders = async(req,res)=>{
    try {

        const [orders] = await db.query(`
            SELECT * FROM orders ORDER BY created_at DESC
        `);
            
        return res.status(200).send({success:true,orders});

    } catch (error) {
        return res.status(500).send({success:false,message:error.message})
    }
}

module.exports = {getAllOrders}