import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url'; // Import URL class for URL cleaning

// Import helper functions
import {
    getSpecValue,
    extractFromTitle, // Note: only needed if used directly here, otherwise implicitly used by other helpers
    cleanUrl,
    extractMemorySize,
    extractMemorySpeed,
    extractLatency,
    extractRamTech,
    extractComputerType,
    generateVariantTitle
} from './conversionHelpers.js';

/**
 * Rewrites the conversion logic for Amazon memory card data.
 * Loads raw data, processes products and their variants,
 * extracts and derives fields based on specified rules,
 * and saves the structured data.
 */
function convertAndSaveData() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const inputFilePath = path.resolve(__dirname, '../public/data/amazon-query-result.json');
    const outputFilePath = path.resolve(__dirname, '../public/data/memory-cards.json');

    console.log(`Loading data from: ${inputFilePath}`);

    // --- Load Data ---
    let rawData;
    let inputData;
    try {
        rawData = fs.readFileSync(inputFilePath, 'utf-8');
        inputData = JSON.parse(rawData);
    } catch (error) {
        console.error(`Error reading or parsing input file ${inputFilePath}:`, error);
        return; // Exit if loading fails
    }

    if (!inputData?.data?.amazonProductCategory?.productResults?.results) {
        console.error('Invalid input data structure. Expected data.amazonProductCategory.productResults.results array.');
        return; // Exit if structure is not as expected
    }

    const rawResults = inputData.data.amazonProductCategory.productResults.results;
    const convertedData = [];

    console.log(`Processing ${rawResults.length} products...`);

    // --- Helper Functions ---

    /**
     * Processes a single product or variant item.
     * @param {object} item - The product or variant object.
     * @param {object} [parentProduct=null] - The parent product (if item is a variant).
     * @returns {object|null} The processed item object or null if invalid.
     */
    const processItem = (item, parentProduct = null) => {
        // --- Validation ---
        if (!item || !item.price?.value) {
            // console.log(`Skipping item (ASIN: ${item?.asin || parentProduct?.asin || 'unknown'}) - Missing price.`);
            return null; // Skip items without a price
        }

        const targetAsin = "B07DRFVY7J";
        const isTarget = item.asin === targetAsin;

        // --- Targeted Logging for B07DRFVY7J --- 
        if (isTarget) {
            console.log(`\n--- Processing Item for ASIN: ${item.asin} ---`);
            console.log(`  Input Title: "${item.title}"`);
            console.log(`  Variant Text (_variantText): "${item._variantText || 'N/A'}"`);
        }

        // --- Field Extraction & Derivation ---
        const computer_memory_size = extractMemorySize(item);

        if (isTarget) {
            console.log(`  Extracted Size (GB): ${computer_memory_size}`);
        }

        const price = parseFloat(item.price.value);

        // Calculate price per GB
        let price_per_gb = 0;
        if (computer_memory_size > 0 && price) {
            price_per_gb = parseFloat((price / computer_memory_size).toFixed(2));
        }
        const price_per_gb_formatted = price_per_gb.toFixed(2);

        const title = item.title || parentProduct?.title || 'N/A'; // Use parent title as fallback only if needed? Stick to item's title.

        return {
            // --- Mapped Fields ---
            id: item.asin, // Use ASIN as the unique ID
            title: item.title || 'N/A',
            price: price,
            symbol: item.price?.symbol || '$',
            url: cleanUrl(item.url || parentProduct?.url), // Use parent URL as fallback for variants if needed
            rating: item.rating || 0,
            ratings_total: item.ratingsTotal || 0,
            brand: item.brand || parentProduct?.brand || 'N/A', // Use parent brand for variants
            is_new: item.isNew !== undefined ? item.isNew : (parentProduct?.isNew !== undefined ? parentProduct.isNew : true), // Inherit isNew status

            // --- Derived Fields ---
            computer_memory_size: computer_memory_size, // number (GB)
            memory_speed: extractMemorySpeed(item), // string (e.g., "3200 MHz")
            latency: extractLatency(item), // string (e.g., "CL16")
            ram_memory_technology: extractRamTech(item), // string (e.g., "DDR4")
            computer_memory_type: extractComputerType(item), // string (e.g., "SODIMM")
            amd_expo_ready: /amd expo/i.test(title), // boolean
            intel_xmp_3_ready: /intel xmp/i.test(title), // boolean

            // --- Calculated Fields ---
            price_per_gb: price_per_gb, // number (for sorting/filtering)
            price_per_gb_formatted: price_per_gb_formatted, // string (for display)

            // --- Extracted from Specs ---
            compatible_devices: getSpecValue(item.technicalSpecifications, 'Compatible Devices') || 'N/A', // string - No variant priority needed

            // Color: Priority: Variant Text -> Spec
            color: (() => {
                if (item._variantText) {
                    const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Silver', 'Gray', 'Gold', 'Pink', 'Purple', 'Orange', 'Yellow', 'Brown'];
                    const variantIsColor = commonColors.find(c => c.toLowerCase() === item._variantText.toLowerCase());
                    if (variantIsColor) return variantIsColor;
                }
                return getSpecValue(item.technicalSpecifications, 'Color') || 'N/A';
            })(),

            // Voltage: Priority: Variant Text -> Spec
            voltage: (() => { // Extract numeric voltage
                // Priority 1: Variant Text
                if (item._variantText) {
                    const variantMatch = item._variantText.match(/(\d+(\.\d+)?)\s?(V|Volt)/i);
                    if (variantMatch && variantMatch[1]) {
                        const voltNum = parseFloat(variantMatch[1]);
                        if (!isNaN(voltNum)) return voltNum;
                    }
                }
                // Priority 2: Spec
                const specVoltageString = getSpecValue(item.technicalSpecifications, 'Voltage');
                if (specVoltageString) {
                    const numericMatch = specVoltageString.match(/(\d+(\.\d+)?)/); // Match integer or decimal
                    if (numericMatch && numericMatch[0]) {
                        return parseFloat(numericMatch[0]);
                    }
                }
                return null; // Return null if not found or not numeric
            })()
        };
    };

    // --- Main Processing Loop ---
    const processedItemsMap = new Map(); // Use a Map to store items by ASIN

    rawResults.forEach((product, index) => {
        // console.log(`Processing product ${index + 1}: ${product.asin}`); // Debug logging

        if (Array.isArray(product.variants) && product.variants.length > 0) {
            // --- Product has Variants --- 
            const parentTitle = product.title; // Get parent title once
            // console.log(`  Product ${product.asin} has ${product.variants.length} variants.`);

            product.variants.forEach(variant => {
                // Skip variant if it doesn't have a valid price
                if (!variant.price?.value) {
                    return; // continue to next variant
                }

                // --- Iterative Refinement Logic ---
                let processedItemData;
                const variantAsin = variant.asin;

                if (processedItemsMap.has(variantAsin)) {
                    // --- Build upon existing item --- 
                    const existingItem = processedItemsMap.get(variantAsin);
                    const refinedTitle = generateVariantTitle(existingItem.title, variant.text);
                    
                    const currentVariantInput = {
                        ...existingItem, // Start with previous state
                        asin: variant.asin, // Ensure current ASIN is used
                        price: variant.price, // Update price from current variant
                        url: variant.url,     // Update URL from current variant
                        title: refinedTitle, // Use title refined from previous state
                        _variantText: variant.text // Current variant text for prioritized extraction
                    };
                    processedItemData = processItem(currentVariantInput);

                } else {
                    // --- First encounter for this variant ASIN --- 
                    const initialTitle = generateVariantTitle(parentTitle, variant.text);
                    
                    const initialVariantInput = {
                        ...product, // Start with parent product data
                        asin: variant.asin, // Use variant's ASIN
                        price: variant.price, // Use variant's price
                        url: variant.url, // Use variant's URL
                        title: initialTitle, // Use title generated from parent
                        _variantText: variant.text // Current variant text for prioritized extraction
                    };
                    processedItemData = processItem(initialVariantInput);
                }

                // Update the map with the latest processed state for this ASIN
                if (processedItemData) {
                    processedItemsMap.set(variantAsin, processedItemData);
                }
                // --- End Iterative Refinement Logic ---
            });
        } else {
            // --- Product has No Variants --- 
            // Process the main product directly
            const processedProduct = processItem(product);

            // Add product to map ONLY if it doesn't already exist (e.g., from a variant)
            if (processedProduct && !processedItemsMap.has(processedProduct.id)) {
                 processedItemsMap.set(processedProduct.id, processedProduct);
                 // console.log(`Added non-variant product ${processedProduct.id} to map`);
            }
        }
    });

    // --- Final Filtering and Conversion --- 
    const finalDataArray = Array.from(processedItemsMap.values());
    const filteredData = finalDataArray.filter(item => item.computer_memory_size > 0);

    console.log(`Processed ${processedItemsMap.size} unique ASINs initially.`);
    console.log(`Filtered down to ${filteredData.length} valid items with memory size > 0.`);

    // --- Final Output Structure ---
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const outputDate = `${formattedDate} ${formattedTime}`; // Format: MM/DD/YYYY HH:mm

    const outputData = {
        date: outputDate,
        data: filteredData // Use the filtered array from the map values
    };

    // --- Save Data ---
    try {
        const outputJson = JSON.stringify(outputData, null, 2); // Pretty print
        fs.writeFileSync(outputFilePath, outputJson, 'utf-8');
        console.log(`Data successfully converted and saved to: ${outputFilePath}`);
    } catch (error) {
        console.error(`Error writing output file ${outputFilePath}:`, error);
    }
}

// --- Run the Conversion ---
convertAndSaveData();