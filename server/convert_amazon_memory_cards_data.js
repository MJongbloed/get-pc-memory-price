import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function convertAndSaveData() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const inputFilePath = path.resolve(__dirname, '../public/data/amazon-query-result.json');
    const outputFilePath = path.resolve(__dirname, '../public/data/memory-cards.json');

    // Read the input file.
    const rawData = fs.readFileSync(inputFilePath, 'utf-8');
    const inputData = JSON.parse(rawData);

    // Extract and convert the data.
    const convertedData = inputData.data.amazonProductCategory.productResults.results
        // Filter out items without Computer Memory Size which is a critical field
        // and items without a price
        .filter(item => {
            // Check if item and technicalSpecifications exist before accessing them
            if (!item || !item.technicalSpecifications) {
                console.log(`Skipping item (ASIN: ${item?.asin || 'unknown'}) because it's missing technical specifications\n`);
                return false;
            }
            
            const memSizeSpec = item.technicalSpecifications.find(spec => spec.name === 'Computer Memory Size');
            if (!memSizeSpec) {
                console.log(`Skipping item (ASIN: ${item.asin}) because it's missing Computer Memory Size specification\n`);
                return false;
            }
            
            // Skip items without a price
            if (!item.price || item.price === null) {
                console.log(`Skipping item (ASIN: ${item.asin}) because it doesn't have a price\n`);
                return false;
            }
            
            return true;
        })
        .map((item, index) => {
            // Helper function to safely get specification values with defaults
            const getSpecValue = (specName, defaultValue = 'N/A') => {
                if (!item.technicalSpecifications) {
                    return defaultValue;
                }
                const spec = item.technicalSpecifications.find(spec => spec.name === specName);
                return spec?.value || defaultValue;
            };

            // Helper function to extract memory speed from title
            const extractMemorySpeedFromTitle = (title) => {
                // Look for patterns like "3200MHz", "3200 MHz", "3200mhz", or "3200 MT/s"
                const speedMatch = title.match(/(\d+)\s*(?:MHz|mhz|MT\/s)/i);
                return speedMatch ? `${speedMatch[1]} MHz` : null;
            };

            // Helper function to clean memory speed value
            const cleanMemorySpeed = (speed) => {
                // Remove any MT/s text and extract just the numeric value
                const cleanSpeed = speed.replace(/MT\/s/i, '').trim();
                // Extract the numeric value
                const numericMatch = cleanSpeed.match(/(\d+)/);
                return numericMatch ? `${numericMatch[1]} MHz` : speed;
            };
            
            // Helper function to clean URL by removing dib and dib_tag parameters
            const cleanUrl = (url) => {
                if (!url) return url;
                try {
                    const urlObj = new URL(url);
                    urlObj.searchParams.delete('dib');
                    urlObj.searchParams.delete('dib_tag');
                    return urlObj.toString();
                } catch (error) {
                    console.log(`Error cleaning URL: ${error.message}. Original URL returned.`);
                    return url;
                }
            };
            
            // Helper function to normalize compatible devices
            const normalizeCompatibleDevices = (devicesString) => {
                if (!devicesString || devicesString === 'N/A') {
                    return 'N/A';
                }
                
                // Define mapping for various device names to standard values
                const deviceMappings = {
                    // Desktop mappings
                    'desktop': 'Desktop',
                    'pc': 'Desktop',
                    'computers': 'Desktop',
                    'computer': 'Desktop',
                    'personal computer': 'Desktop',
                    'desktop pc': 'Desktop',
                    'desktop computer': 'Desktop',
                    'gaming pc': 'Desktop',
                    'gaming desktop': 'Desktop',
                    
                    // Laptop mappings
                    'laptop': 'Laptop',
                    'netbook': 'Laptop',
                    'notebook': 'Laptop',
                    'laptop computer': 'Laptop',
                    'laptop pc': 'Laptop',
                    'gaming laptop': 'Laptop',
                    'portable': 'Laptop',
                    
                    // Server mappings
                    'server': 'Server',
                    'blade server': 'Server',
                    'blade servers': 'Server',
                    'servers': 'Server',
                    'file server': 'Server',
                    
                    // Rack Server mappings
                    'rack server': 'Rack Server',
                    'rack servers': 'Rack Server',
                    'rack mount': 'Rack Server',
                    'rackmount': 'Rack Server',
                    
                    // Workstation mappings
                    'workstation': 'Workstation',
                    'workstations': 'Workstation',
                    'work station': 'Workstation',
                    'professional workstation': 'Workstation'
                };
                
                // Split the input string by commas or other common separators
                const devicesList = devicesString.split(/[,;&|\/]/).map(d => d.trim().toLowerCase());
                
                // Map each device to a standardized version if it exists
                const normalizedDevices = new Set();
                
                devicesList.forEach(device => {
                    // Try exact match first
                    if (deviceMappings[device]) {
                        normalizedDevices.add(deviceMappings[device]);
                    } else {
                        // Try partial match with prioritization
                        // Check for specific matches first before broader ones
                        if (device.includes('rack server') || device.includes('rackmount') || device.includes('rack mount')) {
                            normalizedDevices.add('Rack Server');
                        } else if (device.includes('server')) {
                            normalizedDevices.add('Server');
                        } else if (device.includes('workstation') || device.includes('work station')) {
                            normalizedDevices.add('Workstation');
                        } else if (device.includes('laptop') || device.includes('notebook') || device.includes('netbook')) {
                            normalizedDevices.add('Laptop');
                        } else if (device.includes('desktop') || device.includes('pc') || device.includes('computer')) {
                            normalizedDevices.add('Desktop');
                        } else {
                            // As a fallback, try matching against all mapping keys
                            for (const [key, value] of Object.entries(deviceMappings)) {
                                if (device.includes(key)) {
                                    normalizedDevices.add(value);
                                    break;
                                }
                            }
                        }
                    }
                });
                
                // Make sure we return a valid string, sorted alphabetically
                return normalizedDevices.size > 0 
                    ? Array.from(normalizedDevices).sort().join(', ')
                    : 'N/A';
            };
            
            // Helper function to extract CAS Latency from feature bullets or title
            const extractLatencyFromSource = (bullets, title) => {
                const allowedLatencies = ['CL11', 'CL13', 'CL16', 'CL17', 'CL18', 'CL22', 'CL28', 'CL30', 'CL32', 'CL34', 'CL36', 'CL38', 'CL40'];
                const allowedLatencyNumbers = allowedLatencies.map(l => l.substring(2));
                
                // 1. Try extracting from bullets first
                if (bullets && Array.isArray(bullets)) {
                    const bulletRegex = new RegExp(`CAS Latency(?:[\\s:=of]+)(CL(?:${allowedLatencyNumbers.join('|')}))\\b`, 'i');
                    for (const bullet of bullets) {
                        const match = bullet.match(bulletRegex);
                        if (match && match[1]) {
                            return match[1].toUpperCase(); 
                        }
                    }
                }

                // 2. If not found in bullets, try extracting from title
                if (title) {
                    // Regex to find standalone CLXX values in the title
                    // Uses word boundaries (\b) to avoid partial matches
                    const titleRegex = new RegExp(`\\b(CL(?:${allowedLatencyNumbers.join('|')}))\\b`, 'i');
                    const titleMatch = title.match(titleRegex);
                    if (titleMatch && titleMatch[1]) {
                        return titleMatch[1].toUpperCase();
                    }
                }

                // 3. If not found in either, return N/A
                return 'N/A';
            };

            // Helper function to extract Form Factor from bullets or title
            const extractFormFactor = (bullets, title) => {
                // Define form factors and their regex patterns with variations
                // Order determines priority (most specific first)
                const formFactors = [
                    { name: 'SO-DIMM',   regex: new RegExp('\\b(SO-?DIMM|Small\\s*Outline(?:\\s*DIMM)?)\\b', 'i') },
                    { name: 'MicroDIMM', regex: new RegExp('\\b(Micro-?DIMM)\\b', 'i') },
                    { name: 'LR-DIMM',   regex: new RegExp('\\b(LR-?DIMM|Load\\s*Reduced(?:\\s*DIMM)?)\\b', 'i') },
                    { name: 'RDIMM',     regex: new RegExp('\\b(R-?DIMM|Registered(?:\\s*DIMM)?)\\b', 'i') },
                    { name: 'FB-DIMM',   regex: new RegExp('\\b(FB-?DIMM|Fully\\s*Buffered(?:\\s*DIMM)?)\\b', 'i') },
                    { name: 'UDIMM',     regex: new RegExp('\\b(U-?DIMM|Unbuffered(?:\\s*DIMM)?)\\b', 'i') },
                    { name: 'DIMM',      regex: new RegExp('\\b(DIMM)\\b', 'i') } // Generic DIMM last
                ];

                // Function to search a text source (bullet or title)
                const searchSource = (source) => {
                    if (!source) return null;
                    for (const ff of formFactors) {
                        if (ff.regex.test(source)) {
                            return ff.name; // Return the standardized name
                        }
                    }
                    return null;
                };

                // 1. Try extracting from bullets first
                if (bullets && Array.isArray(bullets)) {
                    for (const bullet of bullets) {
                        const found = searchSource(bullet);
                        if (found) return found;
                    }
                }

                // 2. If not found in bullets, try extracting from title
                const foundInTitle = searchSource(title);
                if (foundInTitle) return foundInTitle;
                
                // 3. If not found in either, return N/A
                return 'N/A';
            };

            const memorySize = parseInt(getSpecValue('Computer Memory Size', '0'));
            
            // Handle null price values
            const price = item.price ? item.price.value : null;
            const symbol = item.price ? item.price.symbol : '$';
            
            // Get memory speed and validate it
            let memorySpeed = getSpecValue('Memory Speed');
            if (!memorySpeed.toLowerCase().includes('mhz')) {
                const speedFromTitle = extractMemorySpeedFromTitle(item.title);
                memorySpeed = speedFromTitle || `${memorySpeed} MHz`;
            }
            // Clean up the memory speed value
            memorySpeed = cleanMemorySpeed(memorySpeed);
            
            // Calculate price per GB - store it as a string with fixed 2 decimal places
            let pricePerGB = 0;
            if (memorySize > 0 && price) {
                pricePerGB = parseFloat((price / memorySize).toFixed(2));
            }
            
            // Also create a formatted version for display with 2 decimal places
            const pricePerGBFormatted = pricePerGB.toFixed(2);
            
            // Get and normalize compatible devices
            const compatibleDevices = normalizeCompatibleDevices(getSpecValue('Compatible Devices'));
            
            // Extract latency using the enhanced helper function (passing bullets and title)
            const latency = extractLatencyFromSource(item.featureBullets, item.title);

            // --- DEBUG LOG --- REMOVED --- 
            // Check the value of latency just before creating the object
            // Use ASIN if available, otherwise index, for easier identification
            // const debugId = item.asin ? `ASIN ${item.asin}` : `Index ${index}`;
            // console.log(`Debug Map [${debugId}]: Latency value before return = ${latency}`); 
            // --- END DEBUG LOG --- REMOVED ---

            return {
                id: (index + 1).toString(),
                title: item.title,
                computer_memory_size: memorySize,
                memory_speed: memorySpeed,
                latency: latency, // Use the extracted latency
                ram_memory_technology: getSpecValue('RAM Memory Technology'),
                price: price,
                price_per_gb: pricePerGB, // For sorting and calculations
                price_per_gb_formatted: pricePerGBFormatted, // For display with 2 decimal places
                symbol: symbol,
                url: cleanUrl(item.url),
                rating: item.rating,
                ratings_total: item.ratingsTotal,
                brand: item.brand,
                compatible_devices: compatibleDevices,
                computer_memory_type: extractFormFactor(item.featureBullets, item.title), // Use the new extractor
                is_new: item.isNew
            };
        });
        
    // Sort by price per GB (ascending)
    convertedData.sort((a, b) => a.price_per_gb - b.price_per_gb);

    // Add the current date and time in a date element.
    const outputData = {
        date: new Date().toLocaleString('en-US', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        data: convertedData
    };
    
    // Format the price_per_gb with 2 decimal places in the final JSON
    // REMOVED REPLACER FUNCTION FOR TESTING
    const outputJson = JSON.stringify(outputData, null, 2);
    
    // Write the output file.
    fs.writeFileSync(outputFilePath, outputJson, 'utf-8');
}

// Run the function
convertAndSaveData()
console.log('Data converted and saved!');