import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url'; // Import URL class for URL cleaning

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
     * Safely gets a technical specification value.
     * @param {Array} specs - The technicalSpecifications array.
     * @param {string} specName - The name of the specification to find.
     * @returns {string|null} The value or null if not found.
     */
    const getSpecValue = (specs, specName) => {
        if (!Array.isArray(specs)) return null;
        const spec = specs.find(s => s?.name?.toLowerCase() === specName?.toLowerCase());
        return spec?.value || null;
    };

    /**
     * Extracts a value from the title using regex.
     * @param {string} title - The product/variant title.
     * @param {RegExp} regex - The regular expression to use.
     * @param {number} [groupIndex=1] - The capturing group index.
     * @returns {string|null} The extracted value or null.
     */
    const extractFromTitle = (title, regex, groupIndex = 1) => {
        if (!title) return null;
        const match = title.match(regex);
        return match?.[groupIndex] || null;
    };

    /**
     * Cleans a URL by removing specific query parameters and adding the required tag parameter.
     * @param {string} url - The original URL.
     * @returns {string} The cleaned URL or the original if cleaning fails.
     */
    const cleanUrl = (url) => {
        if (!url) return url;
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.delete('dib');
            urlObj.searchParams.delete('dib_tag');
            // Add the required tag parameter
            urlObj.searchParams.set('tag', 'accentiofinde-20');
            return urlObj.toString();
        } catch (error) {
            // Log error but return original URL to avoid breaking the process
            // console.warn(`Warning: Could not parse or clean URL "${url}". Returning original. Error: ${error.message}`);
            return url;
        }
    };

    /**
     * Extracts Computer Memory Size (GB).
     * Priority: Title -> Technical Spec.
     * @param {object} item - Product or variant object.
     *        May contain _variantText to prioritize extraction.
     * @returns {number} Memory size in GB, or 0 if not found/parsable.
     */
    const extractMemorySize = (item) => {
        // Priority 1: Extract from variant text if available
        if (item._variantText) {
            // Match the first occurrence of digits followed by GB
            const variantMatch = item._variantText.match(/^(\d+)\s?GB/i);
            if (variantMatch && variantMatch[1]) {
                const size = parseInt(variantMatch[1], 10);
                if (!isNaN(size)) return size;
            }
        }

        // Priority 2: Try title extraction: (\d+)\s?GB (case-insensitive)
        const titleMatch = extractFromTitle(item.title, /(\d+)\s?GB/i);
        if (titleMatch) return parseInt(titleMatch, 10) || 0;

        // Priority 3: Fallback: Technical Spec "Computer Memory Size"
        const specValue = getSpecValue(item.technicalSpecifications, 'Computer Memory Size');
        if (specValue) {
            const numericMatch = specValue.match(/(\d+)/);
            return numericMatch ? parseInt(numericMatch[1], 10) : 0;
        }
        return 0;
    };

    /**
     * Extracts Memory Speed (MHz).
     * Priority: Title -> Technical Spec.
     * @param {object} item - Product or variant object.
     *        May contain _variantText to prioritize extraction.
     * @returns {number|null} Memory speed in MHz as a number, or null.
     */
    const extractMemorySpeed = (item) => {
        let speedString = null;

        // Priority 1: Extract from variant text if available (MHz pattern)
        if (item._variantText) {
            const variantMatchMHz = item._variantText.match(/(\d+)\s?MHz/i);
            if (variantMatchMHz && variantMatchMHz[1]) {
                speedString = variantMatchMHz[1]; // Store numeric part
            }
            // --- NEW: Check for standalone 4-digit number in variant text ---
            if (!speedString) {
                const variantMatch4Digit = item._variantText.match(/\b(\d{4})\b/);
                if (variantMatch4Digit && variantMatch4Digit[1]) {
                    speedString = variantMatch4Digit[1]; // Use the 4-digit number
                    console.log(`  Used 4-digit number (${speedString}) from variant text "${item._variantText}" as speed.`); // DEBUG
                }
            }
        }

        // Priority 2: Try title extraction: (\d+)\s?MHz (case-insensitive)
        if (!speedString) { // Only check title if not found in variant text
            const titleMatch = extractFromTitle(item.title, /(\d+)\s?MHz/i);
            if (titleMatch) {
                speedString = titleMatch; // Store the numeric part string
            }
        }

        // Priority 3: Fallback: Technical Spec "Memory Speed"
        if (!speedString) { // Only check spec if not found above
            const specValue = getSpecValue(item.technicalSpecifications, 'Memory Speed');
            if (specValue) {
                const numericMatch = specValue.match(/(\d+)/);
                if (numericMatch && numericMatch[1]) {
                    speedString = numericMatch[1]; // Store the numeric part string
                }
            }
        }

        // Parse the extracted numeric string
        if (speedString) {
            const speedNumber = parseInt(speedString, 10);
            if (!isNaN(speedNumber)) {
                return speedNumber; // Return the parsed number
            }
        }

        return null; // Return null if not found or not numeric
    };

    /**
     * Extracts CAS Latency.
     * Priority: Title -> Technical Spec "Size".
     * @param {object} item - Product or variant object.
     *        May contain _variantText to prioritize extraction.
     * @returns {string} CAS Latency (e.g., "CL16") or "N/A".
     */
    const extractLatency = (item) => {
        // Priority 1: Extract from variant text if available
        if (item._variantText) {
            const variantMatch = item._variantText.match(/^(CL)\s?(\d+)$/i);
            if (variantMatch && variantMatch[2]) {
                return `CL${variantMatch[2]}`; // Normalize and return
            }
        }

        // Priority 2: Try title extraction: CL\s?\d+ or cl\s?\d+
        const titleMatch = extractFromTitle(item.title, /(CL\s?\d+|cl\s?\d+)/i, 0); // Group 0 for the whole match
        if (titleMatch) {
            return titleMatch.toUpperCase().replace(/\s+/g, ''); // Uppercase and remove space
        }

        // 2. Fallback: Technical Spec "Size" containing pattern like '16cl' or 'cl16'
        const specValue = getSpecValue(item.technicalSpecifications, 'Size');
        if (specValue) {
            const specMatch = specValue.match(/(\d+)\s?cl|cl\s?(\d+)/i);
            if (specMatch) {
                const latencyNumber = specMatch[1] || specMatch[2];
                return `CL${latencyNumber}`;
            }
        }
        return 'N/A';
    };

    /**
     * Extracts RAM Memory Technology (DDR type).
     * Priority: Title -> Specific Technical Specs.
     * @param {object} item - Product or variant object.
     * @returns {string} RAM Technology (e.g., "DDR4") or "N/A".
     */
    const extractRamTech = (item) => {
        const title = item.title || '';
        // 1. Try title extraction (order matters: check DDR5 before DDR4, etc.)
        if (title.match(/DDR5/i)) return 'DDR5';
        if (title.match(/DDR4/i)) return 'DDR4';
        if (title.match(/DDR3L/i)) return 'DDR3L'; // Check DDR3L before DDR3
        if (title.match(/DDR3/i)) return 'DDR3';
        if (title.match(/DDR2/i)) return 'DDR2';
        if (title.match(/DDR\b/i)) return 'DDR'; // Generic DDR last

        // 2. Fallback: Technical Specs
        const specNames = ['Computer Memory Type', 'RAM Memory Technology', 'RAM'];
        for (const name of specNames) {
            const specValue = getSpecValue(item.technicalSpecifications, name);
            if (specValue) {
                if (specValue.match(/DDR5/i)) return 'DDR5';
                if (specValue.match(/DDR4/i)) return 'DDR4';
                if (specValue.match(/DDR3L/i)) return 'DDR3L';
                if (specValue.match(/DDR3/i)) return 'DDR3';
                if (specValue.match(/DDR2/i)) return 'DDR2';
                if (specValue.match(/DDR\b/i)) return 'DDR';
                // Potentially return specValue directly if it's informative but not DDRx?
                // For now, stick to DDR types.
            }
        }
        return 'N/A';
    };

     /**
     * Extracts Computer Memory Type (Form Factor).
     * Priority: Title -> Specific Technical Specs.
     * @param {object} item - Product or variant object.
     *        (Note: Form factor is usually not in variant text, so no priority added here)
     * @returns {string} Form Factor (e.g., "SODIMM", "UDIMM") or "N/A".
     */
     const extractComputerType = (item) => {
        const title = item.title || '';
        // Define form factors and their regex patterns with variations (case-insensitive)
        // Order determines priority (more specific first)
        const formFactors = [
            { name: 'SODIMM',    regex: /\b(SO-?DIMM|Small\s*Outline)\b/i },
            { name: 'MicroDIMM', regex: /\bMicro-?DIMM\b/i },
            { name: 'LRDIMM',    regex: /\bLR-?DIMM|Load\s*Reduced\b/i },
            { name: 'RDIMM',     regex: /\bR-?DIMM|Registered\b/i },
            { name: 'FBDIMM',    regex: /\bFB-?DIMM|Fully\s*Buffered\b/i },
            { name: 'UDIMM',     regex: /\bU-?DIMM|Unbuffered\b/i },
            { name: 'DIMM',      regex: /\bDIMM\b/i } // Generic DIMM last
        ];

        // 1. Try title extraction
        for (const ff of formFactors) {
            if (title.match(ff.regex)) return ff.name;
        }

        // 2. Fallback: Technical Specs
        const specNames = ['Computer Memory Type', 'RAM Memory Technology', 'RAM'];
        for (const name of specNames) {
            const specValue = getSpecValue(item.technicalSpecifications, name);
            if (specValue) {
                for (const ff of formFactors) {
                    if (specValue.match(ff.regex)) return ff.name;
                }
                // If spec exists but doesn't match known types, maybe return it?
                // Or stick to N/A if no known type found. For now, N/A.
            }
        }
        return 'N/A';
     };

    /**
     * Generates a title for a variant by replacing the relevant part of the parent title.
     * @param {string} parentTitle - The title of the main product.
     * @param {string} variantText - The descriptive text of the variant (e.g., "16GB", "6400MHz", "Black").
     * @param {string} [variantAsin=null] - The ASIN of the variant (for targeted debugging).
     * @returns {string} The modified title for the variant, or the parent title if replacement fails.
     */
    const generateVariantTitle = (parentTitle, variantText, variantAsin = null) => {
        // --- DEBUGGING START ---
        const targetAsins = ["B0DYPGPRYZ"]; // Update target ASIN for logging
        const isTarget = variantAsin && targetAsins.includes(variantAsin);

        if (isTarget) {
            console.log(`\n--- generateVariantTitle (TARGET ASIN: ${variantAsin}) ---`);
            console.log(`  Parent Title: "${parentTitle}"`);
            console.log(`  Variant Text: "${variantText}"`);
        }
        // --- DEBUGGING END ---

        if (!parentTitle || !variantText) {
            if (isTarget) console.log(`  Result: Invalid input, returning parent title.`); // DEBUG
            return parentTitle || 'N/A'; // Return original if inputs are invalid
        }

        let newTitle = parentTitle;

        // Normalize variant text for some comparisons
        // const normalizedVariantText = variantText.toUpperCase().replace(/\s+/g, ''); // Might not be needed for replacements

        try {
            // 1. Handle Size (GB) - e.g., "16GB", "32 GB"
            // --- MODIFIED SIZE HANDLING --- 
            // Search for size pattern WITHIN the variant text
            const variantSizeMatch = variantText.match(/(\d+)\s?GB/i);
            if (variantSizeMatch && variantSizeMatch[0]) {
                const variantSizeString = variantSizeMatch[0]; // e.g., "16GB" or "32 GB"
                if (isTarget) console.log(`  Attempting Size (GB) replacement using variant size: ${variantSizeString}...`); // DEBUG
                const parentRegex = /(\d+)\s?GB/i;
                if (isTarget) console.log(`  Parent Regex for size: ${parentRegex}`); // DEBUG
                const potentialNewTitle = newTitle.replace(parentRegex, variantSizeString);
                // Check if replacement actually happened before returning
                if (potentialNewTitle !== newTitle) {
                    if (isTarget) console.log(`  Result (Size Replaced): "${potentialNewTitle}"`); // DEBUG
                    return potentialNewTitle; // Replacement done
                }
                // If no replacement happened, continue to other rules
                if (isTarget) console.log(`  Parent title did not contain replaceable size.`); // DEBUG
            }

            // 2. Handle Multi-pack Size (e.g., "2x32GB")
            const multiSizeMatch = variantText.match(/^(\d+x\d+)\s?GB$/i);
            if (multiSizeMatch) {
                if (isTarget) console.log(`  Attempting Multi-Size (xGB) replacement...`); // DEBUG
                const variantMultiSize = multiSizeMatch[0]; // e.g., "2x32GB"
                const parentRegex = /(\d+x\d+)\s?GB/i;
                if (isTarget) console.log(`  Parent Regex for multi-size: ${parentRegex}`); // DEBUG
                const potentialNewTitle = newTitle.replace(parentRegex, variantMultiSize);
                if (potentialNewTitle !== newTitle) {
                     if (isTarget) console.log(`  Result (Multi-Size Replaced): "${potentialNewTitle}"`); // DEBUG
                     return potentialNewTitle; // Replacement done
                }
                if (isTarget) console.log(`  Parent title did not contain replaceable multi-size.`); // DEBUG
            }

            // 3. Handle Speed (MHz) - e.g., "6000MHz", "6400 MHz", "DDR4-2133"
            let variantSpeedString = null;

            // Check 1: Pattern like "6400MHz" or "6400 MHz"
            const speedMatchMHz = variantText.match(/(\d+)\s?MHz/i);
            if (speedMatchMHz && speedMatchMHz[1]) {
                variantSpeedString = speedMatchMHz[0]; // Use the full string like "6400MHz"
                if (isTarget) console.log(`  Matched speed pattern 1: ${variantSpeedString}`); // DEBUG
            }

            // Check 2: Pattern like "DDR4-2133"
            if (!variantSpeedString) {
                const speedMatchDDR = variantText.match(/DDR\d-(\d{4})/i);
                if (speedMatchDDR && speedMatchDDR[1]) {
                    variantSpeedString = `${speedMatchDDR[1]}MHz`; // Construct "2133MHz"
                    if (isTarget) console.log(`  Matched speed pattern 2 (DDRx-yyyy): ${variantSpeedString}`); // DEBUG
                }
            }

            // Check 3: Standalone 4-digit number (less likely for title replacement)
            // This might be needed if variant text is just "2133"
            // if (!variantSpeedString) {
            //    const speedMatch4Digit = variantText.match(/\b(\d{4})\b/);
            //    if (speedMatch4Digit && speedMatch4Digit[1]) {
            //        variantSpeedString = `${speedMatch4Digit[1]}MHz`; // Construct "2133MHz"
            //        if (isTarget) console.log(`  Matched speed pattern 3 (4-digit): ${variantSpeedString}`); // DEBUG
            //    }
            // }

            if (variantSpeedString) {
                if (isTarget) console.log(`  Attempting Speed (MHz) replacement using: ${variantSpeedString}...`); // DEBUG
                const parentRegex = /(\d+)\s?MHz/i;
                if (isTarget) console.log(`  Parent Regex for speed: ${parentRegex}`); // DEBUG
                const potentialNewTitle = newTitle.replace(parentRegex, variantSpeedString);
                if (potentialNewTitle !== newTitle) {
                    if (isTarget) console.log(`  Result (Speed Replaced): "${potentialNewTitle}"`); // DEBUG
                    return potentialNewTitle; // Replacement done
                }
                if (isTarget) console.log(`  Parent title did not contain replaceable speed.`); // DEBUG
            }

            // 4. Handle Latency (CL) - e.g., "CL16", "CL 18"
            const latencyMatch = variantText.match(/^(CL)\s?(\d+)$/i);
            if (latencyMatch) {
                if (isTarget) console.log(`  Attempting Latency (CL) replacement...`); // DEBUG
                const variantLatency = `CL${latencyMatch[2]}`; // Normalize to CLXX
                const parentRegex = /CL\s?(\d+)/i;
                if (isTarget) console.log(`  Parent Regex for latency: ${parentRegex}`); // DEBUG
                const potentialNewTitle = newTitle.replace(parentRegex, variantLatency);
                if (potentialNewTitle !== newTitle) {
                    if (isTarget) console.log(`  Result (Latency Replaced): "${potentialNewTitle}"`); // DEBUG
                    return potentialNewTitle; // Replacement done
                }
                 if (isTarget) console.log(`  Parent title did not contain replaceable latency.`); // DEBUG
            }

            // 5. Handle Color (Simple word replacement)
            const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Silver', 'Gray', 'Gold', 'Pink', 'Purple', 'Orange', 'Yellow', 'Brown'];
            const variantIsColor = commonColors.find(c => c.toLowerCase() === variantText.toLowerCase());
            if (variantIsColor) {
                if (isTarget) console.log(`  Attempting Color (${variantIsColor}) replacement...`); // DEBUG
                let colorReplaced = false;
                for (const color of commonColors) {
                    if (color.toLowerCase() !== variantIsColor.toLowerCase()) {
                        const parentRegex = new RegExp(color, 'i');
                        if (isTarget) console.log(`  Parent Regex for color '${color}': ${parentRegex}`); // DEBUG
                        const potentialNewTitle = newTitle.replace(parentRegex, variantIsColor);
                        if (potentialNewTitle !== newTitle) {
                             if (isTarget) console.log(`    Found parent color '${color}' to replace.`); // DEBUG
                             if (isTarget) console.log(`  Result (Color Replaced): "${potentialNewTitle}"`); // DEBUG
                             return potentialNewTitle; // Replacement done
                        }
                    }
                }
                // If loop finishes without replacement
                if (isTarget) console.log(`  Could not find a replaceable color in parent title.`); // DEBUG
            }

        } catch (error) {
            console.warn(`Error generating variant title for "${variantText}" from "${parentTitle}":`, error);
            // Fallback to parent title in case of regex or other errors
            if (isTarget) console.log(`  Result: Error occurred, returning parent title.`); // DEBUG
            return parentTitle;
        }

        // If no specific pattern matched and replaced, return the original title
        if (isTarget) console.log(`  Result: No pattern matched, returning parent title.`); // DEBUG
        return parentTitle;
    };

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

        // --- Field Extraction & Derivation ---
        const computer_memory_size = extractMemorySize(item);
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
                    // console.log(`  Skipping variant (ASIN: ${variant.asin}) - Missing price.`);
                    return; // continue to next variant
                }

                // Generate the specific title for this variant
                const variantTitle = generateVariantTitle(parentTitle, variant.text, variant.asin);

                // Construct item data for the variant, inheriting from parent
                // but overriding key fields (asin, price, url)
                const variantItemData = {
                    ...product, // Start with parent product data
                    asin: variant.asin,       // Use variant's ASIN
                    price: variant.price,     // Use variant's price object
                    url: variant.url,         // Use variant's URL
                    title: variantTitle,      // Use the generated variant title
                    _variantText: variant.text, // Pass original variant text for extraction priority
                    // Specs, brand, etc., are still inherited from product for processItem
                    // processItem will use these inherited fields for extraction
                };

                // Process this constructed variant data
                const currentProcessedVariant = processItem(variantItemData);

                // Merge with existing data in the map if any
                if (currentProcessedVariant) { // Only proceed if processing was successful
                    const variantAsin = currentProcessedVariant.id; // which is variant.asin

                    if (processedItemsMap.has(variantAsin)) {
                        // --- Merge with Existing --- 
                        const existingItem = processedItemsMap.get(variantAsin);
                        const mergedItem = { ...existingItem }; // Start with existing data

                        // Update Price & URL from the latest variant encounter
                        mergedItem.price = currentProcessedVariant.price;
                        mergedItem.symbol = currentProcessedVariant.symbol;
                        mergedItem.url = currentProcessedVariant.url;
                        mergedItem.price_per_gb = currentProcessedVariant.price_per_gb;
                        mergedItem.price_per_gb_formatted = currentProcessedVariant.price_per_gb_formatted;

                        // Update Title if the new one seems more specific (simple check: longer)
                        // A more robust check might be needed depending on title generation results
                        if (currentProcessedVariant.title.length > existingItem.title.length) {
                             mergedItem.title = currentProcessedVariant.title;
                        }

                        // Update derived fields ONLY if the current variant provided a valid value
                        // AND the existing value was a default/placeholder
                        const fieldsToUpdate = ['computer_memory_size', 'memory_speed', 'latency', 'color', 'voltage'];
                        fieldsToUpdate.forEach(field => {
                            const currentValue = currentProcessedVariant[field];
                            const existingValue = existingItem[field];
                            const isCurrentValid = !(currentValue === null || currentValue === 0 || currentValue === 'N/A');
                            // Update if current is valid and existing is not, OR if current simply has a value (for cases like 0 voltage being valid?)
                            // Let's prioritize any value from the current processing pass for now
                            if (isCurrentValid) {
                                mergedItem[field] = currentValue;
                            } 
                            // If current wasn't valid, we keep the existing value (which might also be default)
                        });
                        
                        // Update ratings/flags if current has values
                        if (currentProcessedVariant.rating > 0) mergedItem.rating = currentProcessedVariant.rating;
                        if (currentProcessedVariant.ratings_total > 0) mergedItem.ratings_total = currentProcessedVariant.ratings_total;
                        mergedItem.amd_expo_ready = mergedItem.amd_expo_ready || currentProcessedVariant.amd_expo_ready; // Keep true if ever true
                        mergedItem.intel_xmp_3_ready = mergedItem.intel_xmp_3_ready || currentProcessedVariant.intel_xmp_3_ready; // Keep true if ever true

                        processedItemsMap.set(variantAsin, mergedItem);
                        
                    } else {
                        // --- Add New Entry --- 
                        processedItemsMap.set(variantAsin, currentProcessedVariant);
                    }
                }
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