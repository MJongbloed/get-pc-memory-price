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
        .filter(item => {
            const memSizeSpec = item.technicalSpecifications.find(spec => spec.name === 'Computer Memory Size');
            if (!memSizeSpec) {
                console.log(`Skipping item "${item.title}" because it's missing Computer Memory Size specification`);
                return false;
            }
            return true;
        })
        .map((item, index) => {
            // Helper function to safely get specification values with defaults
            const getSpecValue = (specName, defaultValue = 'N/A') => {
                const spec = item.technicalSpecifications.find(spec => spec.name === specName);
                return spec?.value || defaultValue;
            };
            
            const memorySize = parseInt(getSpecValue('Computer Memory Size', '0'));
            const price = item.price.value;
            
            // Calculate price per GB - store it as a string with fixed 2 decimal places
            let pricePerGB = 0;
            if (memorySize > 0 && price) {
                pricePerGB = parseFloat((price / memorySize).toFixed(2));
            }
            
            // Also create a formatted version for display with 2 decimal places
            const pricePerGBFormatted = pricePerGB.toFixed(2);
            
            return {
                id: (index + 1).toString(),
                title: item.title,
                computer_memory_size: memorySize,
                memory_speed: getSpecValue('Memory Speed'),
                latency: getSpecValue('CAS Latency'),
                ram_memory_technology: getSpecValue('RAM Memory Technology'),
                price: price,
                price_per_gb: pricePerGB, // For sorting and calculations
                price_per_gb_formatted: pricePerGBFormatted, // For display with 2 decimal places
                symbol: item.price.symbol,
                url: item.url,
                rating: item.rating,
                ratings_total: item.ratingsTotal,
                brand: item.brand,
                compatible_devices: getSpecValue('Compatible Devices'),
                computer_memory_type: getSpecValue('Computer Memory Type'),
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
    const outputJson = JSON.stringify(outputData, (key, value) => {
        // Format price_per_gb values to always have 2 decimal places
        if (key === 'price_per_gb' && typeof value === 'number') {
            return parseFloat(value.toFixed(2));
        }
        return value;
    }, 2);
    
    // Write the output file.
    fs.writeFileSync(outputFilePath, outputJson, 'utf-8');
}

// Run the function
convertAndSaveData()
console.log('Data converted and saved!');