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
     * Cleans a URL by removing specific query parameters.
     * @param {string} url - The original URL.
     * @returns {string} The cleaned URL or the original if cleaning fails.
     */
    const cleanUrl = (url) => {
        if (!url) return url;
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.delete('dib');
            urlObj.searchParams.delete('dib_tag');
            // Add other params to remove if needed in the future
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
     * @returns {number} Memory size in GB, or 0 if not found/parsable.
     */
    const extractMemorySize = (item) => {
        // 1. Try title extraction: (\d+)\s?GB (case-insensitive)
        const titleMatch = extractFromTitle(item.title, /(\d+)\s?GB/i);
        if (titleMatch) return parseInt(titleMatch, 10) || 0;

        // 2. Fallback: Technical Spec "Computer Memory Size"
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
     * @returns {number|null} Memory speed in MHz as a number, or null.
     */
    const extractMemorySpeed = (item) => {
        let speedString = null;

        // 1. Try title extraction: (\d+)\s?MHz (case-insensitive)
        const titleMatch = extractFromTitle(item.title, /(\d+)\s?MHz/i);
        if (titleMatch) {
            speedString = titleMatch; // Store the numeric part string
        } else {
            // 2. Fallback: Technical Spec "Memory Speed"
            const specValue = getSpecValue(item.technicalSpecifications, 'Memory Speed');
            if (specValue) {
                 // Extract numeric part from spec value
                 const numericMatch = specValue.match(/(\d+)/);
                 if (numericMatch && numericMatch[1]) {
                    speedString = numericMatch[1]; // Store the numeric part string
                 }
                 // If spec value exists but no number, we won't use it here
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
     * @returns {string} CAS Latency (e.g., "CL16") or "N/A".
     */
    const extractLatency = (item) => {
        // 1. Try title extraction: CL\s?\d+ or cl\s?\d+
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
            compatible_devices: getSpecValue(item.technicalSpecifications, 'Compatible Devices') || 'N/A', // string
            color: getSpecValue(item.technicalSpecifications, 'Color') || 'N/A', // Add color field
            voltage: (() => { // Extract numeric voltage
                const voltageString = getSpecValue(item.technicalSpecifications, 'Voltage');
                if (voltageString) {
                    const numericMatch = voltageString.match(/(\d+(\.\d+)?)/); // Match integer or decimal
                    if (numericMatch && numericMatch[0]) {
                        return parseFloat(numericMatch[0]);
                    }
                }
                return null; // Return null if not found or not numeric
            })()
        };
    };

    // --- Main Processing Loop ---
    rawResults.forEach((product, index) => {
        // console.log(`Processing product ${index + 1}: ${product.asin}`); // Debug logging

        // Process the main product directly, ignoring variants for now
        const processedProduct = processItem(product);

        // Add to results ONLY if valid and memory size is greater than 0
        if (processedProduct && processedProduct.computer_memory_size > 0) {
            convertedData.push(processedProduct);
        } else {
             // Optional: Log if the product was skipped due to missing price or zero memory size
             // console.log(`Skipped product (ASIN: ${product?.asin || 'unknown'}) - Invalid price or zero memory size.`);
        }
    });

    console.log(`Processed ${convertedData.length} valid product items with memory size > 0.`); // Update log message

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
        data: convertedData
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