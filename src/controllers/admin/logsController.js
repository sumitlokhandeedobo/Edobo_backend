const db = require("../../config/db");

const getAuditLogs = async (req, res) => {
    try {
        
    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}