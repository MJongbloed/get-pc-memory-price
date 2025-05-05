import { URL } from 'url'; // Needed for cleanUrl

/**
 * Safely gets a technical specification value.
 * @param {Array} specs - The technicalSpecifications array.
 * @param {string} specName - The name of the specification to find.
 * @returns {string|null} The value or null if not found.
 */
export const getSpecValue = (specs, specName) => {
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
export const extractFromTitle = (title, regex, groupIndex = 1) => {
    if (!title) return null;
    const match = title.match(regex);
    return match?.[groupIndex] || null;
};

/**
 * Cleans a URL by removing specific query parameters and adding the required tag parameter.
 * @param {string} url - The original URL.
 * @returns {string} The cleaned URL or the original if cleaning fails.
 */
export const cleanUrl = (url) => {
    if (!url) return url;
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.delete('dib');
        urlObj.searchParams.delete('dib_tag');
        urlObj.searchParams.set('tag', 'accentiofinde-20');
        return urlObj.toString();
    } catch (error) {
        // console.warn(`Warning: Could not parse or clean URL "${url}". Returning original. Error: ${error.message}`);
        return url;
    }
};

/**
 * Extracts Computer Memory Size (GB).
 * Priority: Variant Text -> Title -> Technical Spec.
 * @param {object} item - Product or variant object.
 *        May contain _variantText to prioritize extraction.
 * @returns {number} Memory size in GB, or 0 if not found/parsable.
 */
export const extractMemorySize = (item) => {
    // Priority 1: Extract from variant text if available
    if (item._variantText) {
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
 * Priority: Variant Text (MHz -> 4-digit) -> Title -> Technical Spec.
 * @param {object} item - Product or variant object.
 *        May contain _variantText to prioritize extraction.
 * @returns {number|null} Memory speed in MHz as a number, or null.
 */
export const extractMemorySpeed = (item) => {
    let speedString = null;
    let isMtSpeed = false; // Flag to track if speed source was MT/s

    // Priority 1: Extract from variant text if available (MHz pattern)
    if (item._variantText) {
        const variantMatchMHz = item._variantText.match(/(\d+)\s?MHz/i);
        if (variantMatchMHz && variantMatchMHz[1]) {
            speedString = variantMatchMHz[1]; // Store numeric part
            isMtSpeed = false;
        }
        // Check for MT/s pattern in variant text
        if (!speedString) {
            const variantMatchMTs = item._variantText.match(/(\d+)\s?MT\/s/i);
            if (variantMatchMTs && variantMatchMTs[1]) {
                speedString = variantMatchMTs[1];
                isMtSpeed = true;
            }
        }
        // Check for standalone 4-digit number in variant text
        if (!speedString) {
            const variantMatch4Digit = item._variantText.match(/\b(\d{4})\b/);
            if (variantMatch4Digit && variantMatch4Digit[1]) {
                speedString = variantMatch4Digit[1]; // Use the 4-digit number
                isMtSpeed = false; // Assume MHz if only 4 digits found
            }
        }
    }

    // Priority 2: Try title extraction: (\d+)\s?MHz (case-insensitive)
    if (!speedString) {
        const titleMatch = extractFromTitle(item.title, /(\d+)\s?MHz/i);
        if (titleMatch) {
            speedString = titleMatch; // Store the numeric part string
            isMtSpeed = false;
        }
        // Check for MT/s in title if MHz not found
        if (!speedString) {
            const titleMatchMTs = extractFromTitle(item.title, /(\d+)\s?MT\/s/i);
            if (titleMatchMTs) {
                speedString = titleMatchMTs;
                isMtSpeed = true;
            }
        }
    }

    // Priority 3: Fallback: Technical Spec "Memory Speed"
    if (!speedString) {
        const specValue = getSpecValue(item.technicalSpecifications, 'Memory Speed');
        if (specValue) {
            const numericMatch = specValue.match(/(\d+)/);
            if (numericMatch && numericMatch[1]) {
                speedString = numericMatch[1];
                // Assuming spec value is usually MHz if unit not specified
                isMtSpeed = specValue.includes('MT/s') || false;
            }
        }
    }

    // Parse the extracted numeric string
    if (speedString) {
        const speedNumber = parseInt(speedString, 10);
        if (!isNaN(speedNumber)) {
            // Divide by 2 if the source was MT/s
            return isMtSpeed ? Math.floor(speedNumber / 2) : speedNumber;
        }
    }

    return null; // Return null if not found or not numeric
};

/**
 * Extracts CAS Latency.
 * Priority: Variant Text -> Title -> Technical Spec "Size".
 * @param {object} item - Product or variant object.
 *        May contain _variantText to prioritize extraction.
 * @returns {string} CAS Latency (e.g., "CL16") or "N/A".
 */
export const extractLatency = (item) => {
    // Priority 1: Extract from variant text if available
    if (item._variantText) {
        const variantMatch = item._variantText.match(/^(CL)\s?(\d+)$/i);
        if (variantMatch && variantMatch[2]) {
            return `CL${variantMatch[2]}`; // Normalize and return
        }
    }

    // Priority 2: Try title extraction: CL\s?\d+ or cl\s?\d+
    const titleMatch = extractFromTitle(item.title, /(CL\s?\d+|cl\s?\d+)/i, 0);
    if (titleMatch) {
        return titleMatch.toUpperCase().replace(/\s+/g, ''); // Uppercase and remove space
    }

    // Priority 3: Fallback: Technical Spec "Size" containing pattern like '16cl' or 'cl16'
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
export const extractRamTech = (item) => {
    const title = item.title || '';
    // 1. Try title extraction (order matters: check DDR5 before DDR4, etc.)
    if (title.match(/DDR5/i)) return 'DDR5';
    if (title.match(/DDR4/i)) return 'DDR4';
    if (title.match(/DDR3L/i)) return 'DDR3L';
    if (title.match(/DDR3/i)) return 'DDR3';
    if (title.match(/DDR2/i)) return 'DDR2';
    if (title.match(/DDR\b/i)) return 'DDR';

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
export const extractComputerType = (item) => {
    const title = item.title || '';
    const formFactors = [
        { name: 'SODIMM',    regex: /\b(SO-?DIMM|Small\s*Outline)\b/i },
        { name: 'MicroDIMM', regex: /\bMicro-?DIMM\b/i },
        { name: 'LRDIMM',    regex: /\bLR-?DIMM|Load\s*Reduced\b/i },
        { name: 'RDIMM',     regex: /\bR-?DIMM|Registered\b/i },
        { name: 'FBDIMM',    regex: /\bFB-?DIMM|Fully\s*Buffered\b/i },
        { name: 'UDIMM',     regex: /\bU-?DIMM|Unbuffered\b/i },
        { name: 'DIMM',      regex: /\bDIMM\b/i }
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
        }
    }
    return 'N/A';
};

/**
 * Generates a title for a variant by replacing the relevant part of the parent title.
 * @param {string} parentTitle - The title of the main product.
 * @param {string} variantText - The descriptive text of the variant.
 * @returns {string} The modified title for the variant, or the parent title if replacement fails.
 */
export const generateVariantTitle = (parentTitle, variantText) => {
    if (!parentTitle || !variantText) {
        return parentTitle || 'N/A';
    }

    let newTitle = parentTitle;

    try {
        // 1. Handle Size (GB)
        const variantSizeMatch = variantText.match(/(\d+)\s?GB/i);
        if (variantSizeMatch && variantSizeMatch[0]) {
            const variantSizeString = variantSizeMatch[0];
            const parentRegex = /(\d+)\s?GB/i;
            const potentialNewTitle = newTitle.replace(parentRegex, variantSizeString);
            if (potentialNewTitle !== newTitle) return potentialNewTitle;
        }

        // 2. Handle Multi-pack Size (e.g., "2x32GB")
        const multiSizeMatch = variantText.match(/^(\d+x\d+)\s?GB$/i);
        if (multiSizeMatch) {
            const variantMultiSize = multiSizeMatch[0];
            const parentRegex = /(\d+x\d+)\s?GB/i;
            const potentialNewTitle = newTitle.replace(parentRegex, variantMultiSize);
            if (potentialNewTitle !== newTitle) return potentialNewTitle;
        }

        // 3. Handle Speed (MHz or MT/s)
        let variantSpeedString = null;
        const speedMatchMHz = variantText.match(/(\d+)\s?MHz/i);
        if (speedMatchMHz && speedMatchMHz[0]) {
            variantSpeedString = speedMatchMHz[0];
        }
        if (!variantSpeedString) {
            // Check for MT/s in variant text
            const speedMatchMTs = variantText.match(/(\d+)\s?MT\/s/i);
            if (speedMatchMTs && speedMatchMTs[0]) {
                variantSpeedString = speedMatchMTs[0]; // Use the full "5600MT/s"
            }
        }
        if (!variantSpeedString) {
            const speedMatchDDR = variantText.match(/DDR\d-(\d{4})/i);
            if (speedMatchDDR && speedMatchDDR[1]) {
                variantSpeedString = `${speedMatchDDR[1]}MHz`;
            }
        }
        if (variantSpeedString) {
            // Regex to find speed (MHz or MT/s) in parent title
            const parentRegex = /(\d+)\s?(?:MHz|MT\/s)/i;
            const potentialNewTitle = newTitle.replace(parentRegex, variantSpeedString);
            if (potentialNewTitle !== newTitle) return potentialNewTitle;
        }

        // 4. Handle Latency (CL)
        const latencyMatch = variantText.match(/^(CL)\s?(\d+)$/i);
        if (latencyMatch) {
            const variantLatency = `CL${latencyMatch[2]}`;
            const parentRegex = /CL\s?(\d+)/i;
            const potentialNewTitle = newTitle.replace(parentRegex, variantLatency);
            if (potentialNewTitle !== newTitle) return potentialNewTitle;
        }

        // 5. Handle Color
        const commonColors = ['Black', 'White', 'Red', 'Blue', 'Green', 'Silver', 'Gray', 'Gold', 'Pink', 'Purple', 'Orange', 'Yellow', 'Brown'];
        const variantIsColor = commonColors.find(c => c.toLowerCase() === variantText.toLowerCase());
        if (variantIsColor) {
            for (const color of commonColors) {
                if (color.toLowerCase() !== variantIsColor.toLowerCase()) {
                    const parentRegex = new RegExp(color, 'i');
                    const potentialNewTitle = newTitle.replace(parentRegex, variantIsColor);
                    if (potentialNewTitle !== newTitle) return potentialNewTitle;
                }
            }
        }

    } catch (error) {
        console.warn(`Warning: Error generating variant title for "${variantText}" from "${parentTitle}":`, error);
        return parentTitle;
    }

    return parentTitle;
}; 