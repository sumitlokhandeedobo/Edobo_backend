const db = require("../../config/db");
const fs = require('fs')
const csvParser = require('csv-parser');
const path = require("path");
const os = require('os');
const { promisify } = require("util");
const { PassThrough } = require("stream");


async function parseCSVFile(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = PassThrough.from(buffer);

        stream
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

const bulkProductUpload = async (req, res) => {
    try {

        const file = req.files[0].buffer;
        const csvData = await parseCSVFile(file);

        const { brands, categories } = await collectUniqueBrandsAndCategories(csvData);

        const { extractedCategories, brandMap, categoryMap, subCategoryMap } = await fetchExistingBrandsAndCategories(brands, categories);

        const result = await insertNewBrandsAndCategories(brands, extractedCategories, brandMap, categoryMap, subCategoryMap)

        const BATCH_SIZE = 1000;
        let productBatch = [];
        let imageBatch = [];

        for (let i = 0; i < 200; i++) {
            const product = csvData[i];

            const categoryString = product.categories

            const parts = categoryString.split(':').filter(part => !part.includes('All categories'));
            // Handle category and subcategory assignment based on parts length
            const category = parts[0]?.trim(); // The first part is the category
            let subCategory = null;

            if (parts.length > 2) {
                subCategory = parts[2]?.trim(); // The third part, if it exists, is the subcategory
            } else if (parts.length > 1) {
                subCategory = parts[1]?.trim(); // If only two parts, use the second as subcategory
            }

            const categoryId = categoryMap.get(category) || null;
            const subCategoryId = subCategoryMap.get(subCategory) || null;
            const brandId = brandMap.get(product.brand) || null

            let imageData = null;
            let imageUrl = null;


            function extractUnit(weight) {
                const match = weight.match(/(Gm|ml|Pcs)$/i);
                return match ? match[0] : null;
            }

            function truncateString(str, maxLength) {
                return str && str.length > maxLength ? str.substring(0, maxLength) : str;
            }

            const maxLength = 100;  // Define the maximum length based on your DB schema
            const truncatedLongDescription = truncateString(product.description, maxLength)

            // Prepare each product's values
            productBatch.push([
                product.name,
                product.price || null,
                product.compare_price || null,
                product.discount || null,
                product.short_description || null,
                truncatedLongDescription || null,
                product.inventory_quantity || null,
                product["metafields_product_info.0.image"] || null,
                product["metafields_product_info.0.image"] || null,
                extractUnit(product.metafields_weight) || null,
                product.weight || null,
                product.taxes_id || null,
                product.sku || null,
                product.alias || null,
                product.barcode || null,
                product.hsn || null,
                product.metafields_fssai || null,
                product.disclaimer || null,
                product.metafields_filter_type || null,
                product.expiry || null,
                product.is_product_new || 1,
                product.tag || null,
                brandId || null,
                categoryId || null,
                subCategoryId || null,
                product.publish || 1,
                product.min_limit_to_buy_this_product || null,
                product.max_limit_to_buy_this_product || null,
                product.igst || null,
                product.sgst || null,
                product.cgst || null,
                new Date(),
                new Date()
            ]);

            if (productBatch.length === BATCH_SIZE) {
                const insertedProducts = await bulkInsertProducts(productBatch);  // Insert batch into DB

                if (insertedProducts && insertedProducts.length > 0) {
                    insertedProducts.forEach((insertedProduct, index) => {

                        const metadataString = csvData[index]["metafields_product_info.0._metadata"];
                        console.log("metadataString--", metadataString);

                        if (metadataString) {
                            try {
                                const metadata = JSON.parse(metadataString);
                                if (metadata && metadata.image) {
                                    imageData = metadata.image.name || null;
                                    imageUrl = metadata.image.url || null;
                                }
                            } catch (error) {
                                console.error("Error parsing metadata for image:", csvData[index].name, error);
                            }
                        }

                        if (imageData !== null) {
                            imageBatch.push([
                                insertedProduct.id,
                                imageData || null,
                                imageUrl || null,
                                new Date(),
                                new Date()
                            ]);
                        }
                    });
                    await bulkInsertProductImages(imageBatch)
                }

                productBatch = [];  // Clear the batch
                imageBatch = [];
            }

        }

        if (productBatch.length > 0) {
            const insertedProducts = await bulkInsertProducts(productBatch);

            if (insertedProducts && insertedProducts.length > 0) {
                // Insert remaining product images
                insertedProducts.forEach((insertedProduct, index) => {
                    const metadataString = csvData[index]["metafields_product_info.0._metadata"];
                    if (metadataString) {
                        try {
                            const metadata = JSON.parse(metadataString);
                            if (metadata && metadata.image) {
                                imageData = metadata.image.name || null;
                                imageUrl = metadata.image.url || null;
                            }
                        } catch (error) {
                            console.error("Error parsing metadata for image:", csvData[index].name, error);
                        }
                    }
                    if (imageData !== null) {
                        imageBatch.push([
                            insertedProduct.id,
                            imageData || null,
                            imageUrl || null,
                            new Date(),
                            new Date()
                        ]);
                    }
                });

                await bulkInsertProductImages(imageBatch);

            }

        }

        return res.status(200).send({ success: true, message: "succesfully uploaded data", })

    } catch (error) {
        return res.status(500).send({ success: false, message: error.message })
    }
}



// Helper Functions
async function collectUniqueBrandsAndCategories(data) {
    const brands = [...new Set(data.map(row => row.brand))];
    const categories = [...new Set(data.map(row => row.categories))];
    return { brands, categories };
}

async function fetchExistingBrandsAndCategories(brands, categories) {

    const filteredBrands = brands.filter(brand => brand && brand.trim() !== '')
        .map(brand => brand.trim());

    function extractCategoryAndSubCategory(categoryString) {
        // Split the string by ':' and filter out "All categories"
        const parts = categoryString.split(':').filter(part => !part.includes('All categories'));

        // First part after filtering is the main category, and the second part is the sub-category if it exists
        const category = parts[0]?.trim();
        const subCategory = parts[1]?.trim() || null; // Use null if no sub-category is present

        return { category, subCategory };
    }

    // Extract categories and sub-categories from the categories array
    const extractedCategories = categories
        .map(catString => extractCategoryAndSubCategory(catString))
        .filter(catObj => catObj.category && catObj.category.trim() !== '') // Ensure category is valid
        .filter(catObj => !catObj.subCategory || (catObj.subCategory !== catObj.category && catObj.subCategory.trim() !== '')); // Ensure subCategory is not same as category

    const chunkSize = 50;// Helper function to run the query in chunks
    async function queryInChunks(array, table, column) {
        const results = [];
        for (let i = 0; i < array.length; i++) {
            const chunk = array.slice(i, i + chunkSize);

            const placeholders = chunk.map(() => '?').join(',');

            const [rows] = await db.execute(
                `SELECT id, ${column} FROM ${table} WHERE ${column} IN (${placeholders})`,
                chunk // pass chunk as an array of values
            );

            results.push(...rows);
        }
        return results;
    }

    const existingBrands = await queryInChunks(filteredBrands, 'brands', 'brand_name');

    const uniqueCategories = [...new Set(extractedCategories.map(catObj => catObj.category))];
    const uniqueSubCategories = [...new Set(extractedCategories.map(catObj => catObj.subCategory))];

    // Query both categories and sub-categories in chunks
    const existingCategories = await queryInChunks(uniqueCategories, 'categories', 'name');
    const existingSubCategories = await queryInChunks(uniqueSubCategories, 'categories', 'name');


    // Map categories and sub-categories for easy lookup
    const categoryMap = new Map(existingCategories.map(row => [row.name, row.id]));
    const subCategoryMap = new Map(existingSubCategories.map(row => [row.name, row.id]));

    const brandMap = new Map(existingBrands.map(row => [row.brand_name, row.id]));

    return { extractedCategories, brandMap, categoryMap, subCategoryMap };
}


async function insertNewBrandsAndCategories(brands, categories, brandMap, categoryMap, subCategoryMap) {

    const categoryChunkSize = 20;
    const subCategoryChunkSize = 2;

    function formatDateForMySQL(date) {
        const d = new Date(date);
        const twoDigits = num => String(num).padStart(2, '0');
        return `${d.getUTCFullYear()}-${twoDigits(d.getUTCMonth() + 1)}-${twoDigits(d.getUTCDate())} ${twoDigits(d.getUTCHours())}:${twoDigits(d.getUTCMinutes())}:${twoDigits(d.getUTCSeconds())}`;
    }

    const newBrands = brands.filter(brand => !brandMap.has(brand));

    async function generateUniqueSlug(name, categoryMap, subCategoryMap) {
        let slug = name.toLowerCase().replace(/\s+/g, '-'); // Basic slug generation
        let uniqueSlug = slug;
        let counter = 1;

        // Check both maps to ensure the slug doesn't already exist
        while (categoryMap.has(uniqueSlug) || subCategoryMap.has(uniqueSlug)) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }
        return uniqueSlug;
    }

    const newCategories = [...new Set(categories
        .map(catObj => catObj.category))] // Extract main categories and remove duplicates
        .filter(category => !categoryMap.has(category)); // Only insert new main categories


    // Remove duplicates in new sub-categories and avoid using sub-categories that are the same as the category
    const newSubCategories = [...new Set(categories
        .map(catObj => catObj.subCategory))] // Extract sub-categories and remove duplicates
        .filter(subCategory => subCategory !== null && subCategory.trim() !== "") // Filter out empty or invalid sub-categories
        .filter(subCategory => !newCategories.includes(subCategory)) // Avoid using sub-categories that are the same as a main category
        .filter(subCategory => subCategory !== categories.find(cat => cat.category === subCategory)?.category); // Ensure sub-category is not the same as its parent

    async function checkExistingSlugs(slugs) {
        const [results] = await db.execute(
            `SELECT slug FROM categories WHERE slug IN (?)`,
            [slugs]
        );
        return new Set(results.map(row => row.slug));
    }

    async function insertInChunks(array, chunkSize, insertFunction) {
        for (let i = 0; i < array.length; i += chunkSize) {
            const chunk = array.slice(i, i + chunkSize);

            // Check for existing slugs
            const slugs = await Promise.all(chunk.map(async (name) => generateUniqueSlug(name, categoryMap, subCategoryMap)));
            const existingSlugs = await checkExistingSlugs(slugs);
            const filteredChunk = chunk.filter(async (name) => !existingSlugs.has(await generateUniqueSlug(name, categoryMap, subCategoryMap)));

            await insertFunction(filteredChunk);
        }
    }


    if (newBrands.length > 0) {
        const brandValues = newBrands.map(name => [name, name.toLowerCase(), "", "", 1, new Date(), new Date()])

        const brandPlaceholders = newBrands.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const brandFlatValues = brandValues.flat();

        const [results] = await db.execute(`INSERT INTO brands (brand_name, alias, image_type, image, status, start_date, end_date) VALUES  ${brandPlaceholders}`, brandFlatValues);
        newBrands.forEach((brand, index) => brandMap.set(brand, results.insertId + index));
    }


    if (newCategories.length > 0) {
        const insertCategories = async (chunk) => {
            try {
                const categoryValues = await Promise.all(chunk.map(async (name) => {
                    const slug = await generateUniqueSlug(name, categoryMap, subCategoryMap); // Ensure unique slug
                    return [name, slug, 0, 1, new Date(), new Date()];
                }));
                const categoryPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                const categoryFlatValues = categoryValues.flat().map(value => value === undefined ? null : value); // Replace undefined with null

                const response = await db.execute(
                    `INSERT INTO categories (name, slug, parent_id, status, created_at, updated_at) VALUES ${categoryPlaceholders}`,
                    categoryFlatValues
                );

                const insertedIdsQuery = `
            SELECT id 
            FROM categories 
            WHERE slug IN (${categoryValues.map(() => '?').join(', ')})
            `;
                const [rows] = await db.execute(insertedIdsQuery, categoryValues.map(value => value[1])); // Using slug to retrieve IDs
                const insertedIds = rows.map(row => row.id);

                chunk.forEach((name, index) => {
                    categoryMap.set(name, insertedIds[index]);
                });
            } catch (error) {
                console.error('Error inserting categories:', error)
            }
        };
        await insertInChunks(newCategories, categoryChunkSize, insertCategories);
    }

    // Insert new sub-categories into the database

    if (newSubCategories.length > 0) {
        try {
            const insertSubCategories = async (chunk) => {

                const subCategoryValues = await Promise.all(categories
                    .filter(catObj => chunk.includes(catObj.subCategory)) // Get only sub-categories in the current chunk
                    .map(async (catObj) => {
                        const slug = await generateUniqueSlug(catObj.subCategory, categoryMap, subCategoryMap); // Ensure unique slug
                        const parent_id = categoryMap.get(catObj.category) || null; // Get parent category ID or use null

                        return [
                            catObj.subCategory,
                            slug,
                            parent_id, // Use the ID of the main category as parent_id, or null if not found
                            1,
                            new Date(),
                            new Date()
                        ];
                    }));

                const subCategoryPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(',');

                const subCategoryFlatValues = subCategoryValues.flat().map(value => value === undefined ? null : value); // Replace undefined with null

                console.log("Executing SQL:", `INSERT INTO categories (name, slug, parent_id, status, created_at, updated_at) VALUES ${subCategoryPlaceholders}`, subCategoryFlatValues);

                const res = await db.execute(
                    `INSERT INTO categories (name, slug, parent_id, status, created_at, updated_at) VALUES ${subCategoryPlaceholders}`,
                    subCategoryFlatValues
                );
                const insertedIdsQuery = `
                SELECT id 
                FROM categories 
                WHERE slug IN (${subCategoryValues.map(() => '?').join(', ')})
                `;
                const [rows] = await db.execute(insertedIdsQuery, subCategoryValues.map(value => value[1])); // Using slug to retrieve IDs
                const insertedIds = rows.map(row => row.id);

                // Map the inserted sub-category IDs to the subCategoryMap
                chunk.forEach((subCategory, index) => {
                    subCategoryMap.set(subCategory, insertedIds[index]);
                });

            };
            await insertInChunks(newSubCategories, subCategoryChunkSize, insertSubCategories);
        } catch (error) {
            console.error("Error inserting sub-categories:", error);
        }

    }

    return { brandMap, categoryMap, subCategoryMap };

}


const bulkInsertProducts = async (productValues) => {
    const insertQuery = `
        INSERT INTO products (
            product_name, price, compare_price, discount, short_description, long_description, 
            qty, thumb_image, thumb_image_url, weight_name, weight_value, taxes_id, sku, alias, 
            barcode, hsn, fassai, disclaimer, product_filter_type, expiry, is_product_new, 
            tag, brands_id, category_id, sub_category_id, status, min, max, igst, sgst, cgst, 
            created_at, updated_at
        ) VALUES ?`;

    const connection = await db.getConnection(); // Get a connection from the pool

    try {
        await connection.beginTransaction();  // Begin a transaction

        const [result] = await connection.query(insertQuery, [productValues]);

        const insertedProductIds = [];
        const startId = result.insertId;  // The first inserted product ID

        // Collect all inserted product IDs
        for (let i = 0; i < result.affectedRows; i++) {
            insertedProductIds.push({ id: startId + i });
        }

        await connection.commit();  // Commit the transaction

        return insertedProductIds;
    } catch (error) {
        await connection.rollback();  // Roll back the transaction in case of an error
        console.error('Error during bulk insert:', error);
    } finally {
        connection.release();  // Release the connection back to the pool
    }
};


const bulkInsertProductImages = async (imageValues) => {
    const insertQuery = `
        INSERT INTO products_image (
            products_id, image, image_url, created_at, updated_at
        ) VALUES ?`;

    const connection = await db.getConnection(); // Get a connection from the pool

    try {
        await connection.beginTransaction();  // Begin a transaction

        await connection.query(insertQuery, [imageValues]);

        await connection.commit();  // Commit the transaction
    } catch (error) {
        await connection.rollback();  // Roll back the transaction in case of an error
        console.error('Error during bulk image insert:', error);
    } finally {
        connection.release();  // Release the connection back to the pool
    }
};

module.exports = { bulkProductUpload }