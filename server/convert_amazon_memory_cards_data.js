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
            
            return {
                id: (index + 1).toString(),
                title: item.title,
                computer_memory_size: parseInt(getSpecValue('Computer Memory Size', '0')),
                memory_speed: getSpecValue('Memory Speed'),
                latency: getSpecValue('CAS Latency'),
                ram_memory_technology: getSpecValue('RAM Memory Technology'),
                price: item.price.value,
                symbol: item.price.symbol,
                url: item.url,
                rating: item.rating,
                ratings_total: item.ratingsTotal,
                brand: item.brand,
                compatible_devices: getSpecValue('Compatible Devices'),
                computer_memory_type: getSpecValue('Computer Memory Type'),
                in_stock: item.stockEstimate.inStock,
                is_new: item.isNew
            };
        });

    // Add the current date and time in a date element.
    const outputData = {
        date: new Date().toLocaleString('en-US', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        data: convertedData
    };
    // Write the output file.
    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2), 'utf-8');
}

// Run the function
convertAndSaveData();