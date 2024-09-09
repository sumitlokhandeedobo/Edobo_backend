const db = require("../../config/db");


const getUserDetails = async (req, res) => {
    try {

        const { user_type } = req.query

        let query = `
            SELECT 
                users.id, users.name, users.last_name, users.email, users.email_verified, 
                users.role_id, users.use_temp_password, users.profile_img, users.profile_img_url, 
                users.phone_number, users.gender, users.age_range, users.user_type, 
                users.user_address_id, users.status, users.created_at, users.updated_at, 
                roles.id as role_id, roles.name as role_name, roles.role_type, roles.status as role_status, 
                roles.created_at as role_created_at, roles.updated_at as role_updated_at,
                users_address.customer_shipping_addess, users_address.customer_billing_address, 
                users_address.default_address, users_address.state_id, users_address.city_id, 
                users_address.pincode, users_address.store_id, users_address.created_at as address_created_at, 
                users_address.updated_at as address_updated_at
            FROM users
            JOIN roles ON users.role_id = roles.id
            LEFT JOIN users_address ON users.id = users_address.users_id
        `;

        const conditions = [];
        if (user_type) {
            conditions.push(`users.user_type = ${db.escape(user_type)}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        const [results] = await db.query(query);

        const formattedResults = results.map(user => ({
            id: user.id,
            name: user.name,
            last_name: user.last_name,
            email: user.email,
            email_verified: user.email_verified,
            use_temp_password: user.use_temp_password,
            profile_img: user.profile_img,
            profile_img_url: user.profile_img_url,
            phone_number: user.phone_number,
            gender: user.gender,
            age_range: user.age_range,
            user_type: user.user_type,
            status: user.status,
            created_at: user.created_at,
            updated_at: user.updated_at,
            role: {
                id: user.role_id,
                name: user.role_name,
                role_type: user.role_type,
                status: user.role_status,
                created_at: user.role_created_at,
                updated_at: user.role_updated_at
            },
            address: {
                customer_shipping_addess: user.customer_shipping_addess,
                customer_billing_address: user.customer_billing_address,
                default_address: user.default_address,
                state_id: user.state_id,
                city_id: user.city_id,
                pincode: user.pincode,
                store_id: user.store_id,
                created_at: user.address_created_at,
                updated_at: user.address_updated_at
            }
        }));

        return res.status(200).send({ success: true, data: formattedResults });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}


const getUsersList = async (req, res) => {
    try {
        const { user_type } = req.query
        const userRole = req.user.user_type

        if (userRole != "super_admin") {
            return res.status(403).send({ success: false, message: "For getting all UsersList requires super admin role" })
        }

        let query = `
            SELECT 
                users.id, users.name, users.email, users.phone_number, 
                users_address.default_address
            FROM users
            LEFT JOIN users_address ON users.id = users_address.users_id
        `;

        let conditions = []
        if (user_type) {
            conditions.push(`users.user_type = ${db.escape(user_type)}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        const [results] = await db.query(query);

        const formattedResults = results.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            default_address: user.default_address || null
        }));

        return res.status(200).send({ success: true, results: formattedResults });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}


const getSpecificUserDetails = async (req, res) => {
    const user_id = req.params.userId
    const userRole = req.user.user_type
    try {
        if (userRole != "super_admin") {
            return res.status(403).send({ success: false, message: "For getting userDetails requires super admin role" })
        }

        let query = `
           SELECT 
                users.id, users.name, users.email, users.phone_number, users.created_at, users.use_temp_password, users.profile_img, users.status,
                users_address.default_address, users_address.pincode,
                roles.name AS role_name, roles.role_type,
                orders.id AS order_id, orders.invoice_no, orders.total, orders.order_status_id,orders.firstname, orders.lastname,
                orders.created_at AS placed_date,
                order_products.created_at AS order_date,
                order_statuses.order_status_name, 
                order_products.product_id, order_products.name AS product_name, 
                order_products.quantity, order_products.price, order_products.total AS product_total,
                users_address.customer_shipping_addess AS shipping_address,
                users_address.customer_billing_address AS billing_address,
                state_master.name AS state_name, city_master.name AS city_name
            FROM users
            LEFT JOIN roles ON users.role_id = roles.id
            LEFT JOIN users_address ON users.id = users_address.users_id
            LEFT JOIN orders ON users.id = orders.customer_id
            LEFT JOIN order_statuses ON orders.order_status_id = order_statuses.id
            LEFT JOIN order_products ON orders.id = order_products.order_id
            LEFT JOIN state_master ON users_address.state_id = state_master.id
            LEFT JOIN city_master ON users_address.city_id = city_master.id
            WHERE users.id = ?
        `;

        const [results] = await db.query(query, [user_id]);

        const user = {
            id: results[0].id,
            firstname: results[0].firstname,
            lastname: results[0].lastname,
            created_on: results[0].created_at,
            use_temporary_password: results[0].use_temp_password,
            image: results[0].profile_img,
            email: results[0].email,
            phone_number: results[0].phone_number,
            active: results[0].status,
            role: {
                name: results[0].role_name,
                role_type: results[0].role_type
            },
            address: {
                state: results[0].state_name,
                city: results[0].city_name,
                address: results[0].default_address || results[0].shipping_address,
                zip: results[0].pincode
            },
            orders: results.map(row => ({
                order_id: row.order_id,
                invoice_no: row.invoice_no,
                total: row.total,
                order_status: row.order_status_name,
                order_date: row.order_date,
                placed_date: row.placed_date,
                shipping_address: row.shipping_address,
                billing_address: row.billing_address,
                products: results
                    .filter(r => r.order_id === row.order_id)
                    .map(r => ({
                        product_id: r.product_id,
                        quantity: r.quantity,
                    }))
            })).filter(order => order.order_id) 
        };

        return res.status(200).json({ success: true, data: user });

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}


module.exports = { getUserDetails, getUsersList, getSpecificUserDetails }