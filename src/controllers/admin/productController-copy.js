const db = require("../../config/db");
const fs = require('fs')
const csv = require('csv-parser');
const path = require("path");
const os = require('os');
const { promisify } = require("util");

const writeFile = promisify(fs.writeFile);
const unlinkFile = promisify(fs.unlink);

const brandCache = new Map();

const bulkProductUpload = async (req, res) => {
    try {

        const fileBuffer = req.files[0].buffer;
        const tempFilePath = path.join(__dirname, 'temp', 'products-upload.csv');

        await writeFile(tempFilePath, fileBuffer);

        const batchSize = 500;
        let batch = [];

        // Parse the temporary CSV file
       const csvStream =  fs.createReadStream(tempFilePath)
            .pipe(csv())
            .on('data', async (row) => {

                const brandIdArray = await getBrandId(row['brand'])

                const { category_id, sub_category_id } = await getCategoryAndSubCategoryIds(row['categories'])

                const brandId = brandIdArray.length > 0 ? brandIdArray[0].id : null;

                // Ensure that values are numbers
                const selling_price = parseFloat(row['Compare OR Base Price']);
                const tax = parseFloat(row['Tax in value']);
                const mrp_price = parseFloat(row['MRP Price']);

                // Tax calculation
                const price_1 = selling_price / (1 + (tax / 100));
                const price_2 = roundToDecimal(price_1, 2); // Round to 2 decimal places

                const igst_price = selling_price - price_2;
                const divided_price = roundToDecimal(igst_price / 2, 2); // Round to 2 decimal places

                // Percentage discount on product
                const price_diff_1 = mrp_price - selling_price;
                const price_diff_2 = (price_diff_1 / mrp_price) * 100;
                const price_diff = roundToDecimal(price_diff_2, 0); // Round to 0 decimal places for percentage

                const timestamp = new Date()

                //Insert into products table
                const insertProductQuery = `
                    INSERT INTO products (
                        product_name, price, compare_price, discount, short_description,
                        long_description, qty, thumb_image, thumb_image_url, weight_name, weight_value, taxes_id,
                        sku, alias, barcode, hsn, fassai, disclaimer, product_filter_type, expiry, 
                        is_product_new, tag, brands_id, category_id, sub_category_id, status, min, max, igst, sgst, cgst, created_at, updated_at
                    )VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const productValues = [
                    row['Product'], row['MRP Price'], selling_price, price_diff, row['Short Description'],
                    row['Long Description'], row['QTY'], row['Thumbnail Image'], `/public/prdt_img/${row['Thumbnail Image']}`, row['Weight'],
                    row['Weight Value'], tax, row['SKU'], row['Alias'], row['Barcode'], row['HSN'],
                    row['Fassai'], row['Disclaimer'], row['Product Type'], row['Expiry'],
                    row['Is Product New(1=new & 0=not)'], row['Tag'], brandId, category_id, sub_category_id, row['Status'],
                    row['Min'], row['Max'], igst_price, divided_price, divided_price, new Date(), new Date()
                ];
                console.log(productValues);

                return res.status(200).send({ success: true, data: productValues })

                const [insertResult] = await db.query(insertProductQuery, productValues);
                const productId = insertResult.insertId;

                await insertProductImages(productId, row['Upload Images'])

                await processInventoryManagement(productId, row['Inventory Management']);

                if (row['Varient_Product']) {
                    const variantProducts = JSON.parse(row['Varient_Product']);
                    for (let variantProductName of variantProducts) {
                        await handleVarientProduct(productId, variantProductName);
                    }
                }

                if (row['Related_Products']) {
                    const relatedProducts = JSON.parse(row['Related_Products']);
                    await handleRelatedProduct(productId, relatedProducts.map(p => p.name));
                }

                if (row['products_seo']) {
                    await handleProductSEO(productId, row['products_seo']);
                }

            })
            .on('end', async () => {
                if(batch.length > 0){
                    await insertProductBatch(batch)
                }
                await unlinkFile(tempFilePath);
                return res.status(200).send({ success: true, message: 'CSV file processed and data imported successfully' });
            })

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}



// Helper Functions

function roundToDecimal(value, decimalPlaces) {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
}

const getBrandId = async (brandName) => {

    if (brandCache.has(brandName)) {
        return brandCache.get(brandName);
    }

    const [rows] = await db.query(
        'SELECT id FROM brands WHERE brand_name = ?',
        [brandName]
    );
    brandCache.set(brandName, rows);
    console.log("rows", rows);
    if (rows.length > 0) {
        return rows[0].id;
    }

    const alias = brandName.toLowerCase()
    //If brand is not found, insert a new one
    const [result] = await db.query(
        'INSERT INTO brands (brand_name, alias, image_type, image, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [brandName, alias, "", "", 1, new Date(), new Date()]
    );

    // Return the new brand id
    return [{ id: result.insertId }];
};


// const getCategoryAndSubCategoryIds = async (categoryName) => {

//     const [rows] = await db.query('SELECT id, parent_id FROM categories WHERE name = ?', [categoryName]);
//     if (rows.length === 0) {
//         return { category_id: null, sub_category_id: null };  
//     }

//     const category = rows[0];

//     if (category.parent_id === 0 || category.parent_id === null) {
//         // Parent category, no sub-category
//         return { category_id: category.id, sub_category_id: null };
//     } else {
//         // Sub-category, parent_id is the category_id
//         return { category_id: category.parent_id, sub_category_id: category.id };
//     }
// };


const getCategoryAndSubCategoryIds = async (categoryPath) => {
    try {
        // Split the category string by ":"
        const categories = categoryPath.split(':');

        let categoryId = null;
        let subCategoryId = null;

        // Step 1: Handle main category (the first part of the split)
        const mainCategoryName = categories[0];
        console.log("mainCategoryName", mainCategoryName);

        const [categoryRows] = await db.query(
            'SELECT id FROM categories WHERE name = ? AND (parent_id IS NULL OR parent_id = 0)',
            [mainCategoryName]
        );
        console.log("categoryRows--", categoryRows);

        // if (categoryRows.length === 0) {
        //     // If the main category doesn't exist, insert it
        //     const [categoryInsertResult] = await db.query(
        //         'INSERT INTO categories (name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
        //         [mainCategoryName, null, new Date(), new Date()]
        //     );
        //     categoryId = categoryInsertResult.insertId;
        // } else {
        //     categoryId = categoryRows[0].id;
        // }

        // Step 2: Handle sub-categories, if any (2nd and 3rd parts)
        // if (categories.length > 1) {
        //     for (let i = 1; i < categories.length; i++) {
        //         const subCategoryName = categories[i];
        //         const [subCategoryRows] = await db.query(
        //             'SELECT id FROM categories WHERE name = ? AND parent_id = ?',
        //             [subCategoryName, categoryId]
        //         );

        //         if (subCategoryRows.length === 0) {
        //             // If the sub-category doesn't exist, insert it
        //             const [subCategoryInsertResult] = await db.query(
        //                 'INSERT INTO categories (name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
        //                 [subCategoryName, categoryId, new Date(), new Date()]
        //             );
        //             subCategoryId = subCategoryInsertResult.insertId;
        //         } else {
        //             subCategoryId = subCategoryRows[0].id;
        //         }

        //         // Set the categoryId to the subCategoryId for the next level
        //         categoryId = subCategoryId;
        //     }
        // }

        // Return the final category ID and sub-category ID
        return { category_id: categoryId, sub_category_id: subCategoryId };
    } catch (error) {
        console.error('Error getting or creating category/sub-category:', error);
        throw error;
    }
};


const insertProductImages = async (productId, imagesString) => {
    const images = imagesString.split(',').map(img => img.trim());
    const insertQuery = 'INSERT INTO products_image (products_id, image, image_url) VALUES ?';
    const values = images.map(image => [productId, image, `/public/prd_img/${image}`]);
    await db.query(insertQuery, [values]);
};


const processInventoryManagement = async (productId, inventoryManagementJson) => {
    try {
        // Parse the Inventory Management JSON field from the CSV
        const inventoryData = JSON.parse(inventoryManagementJson);
        const timestamp = new Date()
        // Loop through each store's inventory data
        for (let store of inventoryData) {
            // Fetch the sub-store by name from sub_stores table
            const [subStoreRows] = await db.query(
                'SELECT id, sub_store_name FROM sub_stores WHERE sub_store_name = ?',
                [store.store_name]
            );

            if (subStoreRows.length > 0) {
                const subStore = subStoreRows[0];
                const subStoreProductData = {
                    sub_stores_id: subStore.id,
                    sub_store_name: subStore.sub_store_name,
                    mrp: parseFloat(store.mrp),
                    selling_price: parseFloat(store.selling_price),
                    qty: parseInt(store.qty),
                    created_by: 1,
                    status: store.status
                };

                // Insert inventory for the product at the sub-store
                const query = `
                    INSERT INTO sub_stores_products (
                        products_id, sub_stores_id, sub_store_name, mrp, selling_price, qty, created_by, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const values = [
                    productId, subStoreProductData.sub_stores_id, subStoreProductData.sub_store_name,
                    subStoreProductData.mrp, subStoreProductData.selling_price,
                    subStoreProductData.qty, subStoreProductData.created_by, subStoreProductData.status, timestamp, timestamp
                ];

                await db.query(query, values);
            } else {
                console.error(`Sub-store not found for: ${store.store_name}`);
            }
        }
    } catch (error) {
        console.error('Error processing inventory:', error);
        throw error
    }
};


const handleVarientProduct = async (productId, variantProductName) => {
    try {

        const [existingProducts] = await db.query(
            'SELECT id FROM products WHERE product_name = ?',
            [variantProductName.name]
        );
        const timestamp = new Date()
        if (existingProducts.length > 0) {
            // Get the variant product ID
            const variantProductId = existingProducts[0].id;

            // Insert the relationship into the product_varient table
            const query = `
                INSERT INTO product_variant (product_id, varient_product_id, created_at, updated_at)
                VALUES (?, ?, ?, ?)
            `;

            const values = [productId, variantProductId, timestamp, timestamp];
            await db.query(query, values);
        } else {
            console.log(`Variant product not found: ${variantProductName.name}`);
        }
    } catch (error) {
        console.error('Error handling variant products:', error);
        throw error;
    }
}

const handleRelatedProduct = async (productId, relatedProductNames) => {
    try {
        for (const relatedProductName of relatedProductNames) {
            // Find if the related product exists
            const [existingProducts] = await db.query(
                'SELECT id FROM products WHERE product_name = ?',
                [relatedProductName]
            );
            const timestamp = new Date()
            if (existingProducts.length > 0) {
                // Get the related product ID
                const relatedProductId = existingProducts[0].id;

                // Insert the relationship into the related_products table
                const query = `
                    INSERT INTO related_products (products_id, related_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                `;

                const values = [productId, relatedProductId, timestamp, timestamp];
                await db.query(query, values);
            } else {
                console.log(`Related product not found: ${relatedProductName}`);
            }
        }
    } catch (error) {
        console.error('Error handling variant products:', error);
        throw error;
    }
}


const handleProductSEO = async (productId, seoData) => {
    try {
        // Parse the SEO data
        const seoEntries = JSON.parse(seoData);

        for (const seoEntry of seoEntries) {
            // Insert SEO data into products_seo table
            const query = `
                INSERT INTO products_seo (product_id, seo_title, seo_description, seo_keywords, seo_canonical_url, seo_sitemap_priority, seo_slug, seo_sitemap_frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                productId,
                seoEntry.seo_title,
                seoEntry.seo_description,
                seoEntry.seo_keywords,
                seoEntry.seo_canonical_url,
                seoEntry.seo_sitemap_priority,
                seoEntry.seo_slug,
                seoEntry.seo_sitemap_frequency
            ];

            await db.query(query, values);
        }
    } catch (error) {
        console.error('Error handling product SEO:', error);
        throw error; // Rethrow to ensure rollback if needed
    }
};



module.exports = { bulkProductUpload }