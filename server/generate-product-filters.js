import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Extracts unique brands from memory-cards.json and generates a product-filters.json file
 * This function can be run to update the filters whenever the memory-cards data changes
 */
function generateProductFilters() {
  try {
    // Setup file paths
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const inputFilePath = path.resolve(__dirname, '../public/data/memory-cards.json');
    const outputFilePath = path.resolve(__dirname, '../public/data/product-filters.json');

    // Read the memory cards data
    console.log(`Reading memory cards data from ${inputFilePath}...`);
    const rawData = fs.readFileSync(inputFilePath, 'utf-8');
    const memoryCardsData = JSON.parse(rawData);

    // Extract all unique brands
    const allBrands = memoryCardsData.data
      .filter(item => item.brand && item.brand.trim() !== '')
      .map(item => item.brand.trim());
    
    // Create a set of unique brands and convert back to array
    const uniqueBrands = [...new Set(allBrands)].sort();

    console.log(`Found ${uniqueBrands.length} unique brands.`);

    // Create the filters object
    const filtersData = {
      lastUpdated: new Date().toISOString(),
      brands: uniqueBrands
    };

    // Write the output file
    fs.writeFileSync(outputFilePath, JSON.stringify(filtersData, null, 2), 'utf-8');
    console.log(`Product filters successfully saved to ${outputFilePath}`);
    
    return {
      success: true,
      brandCount: uniqueBrands.length,
      filePath: outputFilePath
    };
  } catch (error) {
    console.error('Error generating product filters:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the function if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = generateProductFilters();
  if (result.success) {
    console.log(`Generated product filters with ${result.brandCount} brands.`);
  } else {
    console.error('Failed to generate product filters:', result.error);
    process.exit(1);
  }
}

// Export the function for use in other modules
export default generateProductFilters; 