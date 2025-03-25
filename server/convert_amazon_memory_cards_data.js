import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

function convertAndSaveData() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const inputFilePath = path.resolve(__dirname, '../public/data/amazon-query-result.json');
    const outputFilePath = path.resolve(__dirname, '../public/data/memory-cards.json');

    // Read the input file
    const rawData = fs.readFileSync(inputFilePath, 'utf-8');
    const inputData = JSON.parse(rawData);

    // Extract and convert the data
    const convertedData = inputData.data.amazonProductCategory.productResults.results.map((item, index) => ({
        id: (index + 1).toString(),
        title: item.title,
        computer_memory_size: parseInt(item.technicalSpecifications.find(spec => spec.name === 'Computer Memory Size').value),
        memory_speed: item.technicalSpecifications.find(spec => spec.name === 'Memory Speed').value,
        latency: item.technicalSpecifications.find(spec => spec.name === 'CAS Latency')?.value || 'N/A',
        ram_memory_technology: item.technicalSpecifications.find(spec => spec.name === 'RAM Memory Technology').value,
        price: item.price.value,
        symbol: item.price.symbol,
        url: item.url,
        rating: item.rating,
        ratings_total: item.ratingsTotal,
        brand: item.brand,
        compatible_devices: item.technicalSpecifications.find(spec => spec.name === 'Compatible Devices').value,
        computer_memory_type: item.technicalSpecifications.find(spec => spec.name === 'Computer Memory Type').value,
        in_stock: item.stockEstimate.inStock,
        is_new: item.isNew
    }));

    // Add the current date and time
    const outputData = {
        date: new Date().toISOString(),
        data: convertedData
    };

    // Write the output file
    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2), 'utf-8');
}

// Run the function
convertAndSaveData();