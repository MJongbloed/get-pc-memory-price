import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Validate that API key exists
if (!process.env.CANOPY_API_KEY) {
    throw new Error('CANOPY_API_KEY environment variable is not set');
}

async function fetchAmazonData() {
    const queryTemplate = `
query amazonProduct {
  amazonProductCategory(input: {categoryId: "172500", domain: US}) {
    productResults(input: {page: "%d", sort: AVERAGE_CUSTOMER_REVIEW}) {
      pageInfo {
        hasNextPage
      }
      results {
        asin
        brand
        featureBullets
        isNew
        price {
          value
          symbol
        }
        rating
        ratingsTotal
        reviewsTotal
        title
        technicalSpecifications {
          name
          value
        }
        url
        variants {
          asin
          attributes {
            name
            value
          }
          text
          url
          price {
            value
            symbol
          }
        }
      }
    }
  }
}
`;

    // Ensure the directory exists before writing
    const dir = path.join(__dirname, '../public/data');
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (dirError) {
        throw new Error(`Failed to create directory ${dir}: ${dirError.message}`);
    }

    const filePath = path.join(dir, 'amazon-query-result.json');
    
    // Initialize with empty results structure
    let allResults = { data: { amazonProductCategory: { productResults: { results: [] } } } };
    
    // Clear the existing file at the start
    try {
        fs.writeFileSync(filePath, JSON.stringify(allResults, null, 2));
        console.log('Started with a clean slate - cleared existing data file');
    } catch (writeError) {
        throw new Error(`Failed to clear file ${filePath}: ${writeError.message}`);
    }

    // Keep track of ASINs we've already processed to avoid duplicates
    const processedAsins = new Set();

    // Fetch data from 20 pages
    for (let page = 1; page <= 20; page++) {
        console.log(`Fetching page ${page} of 20...`);
        
        try {
            const query = queryTemplate.replace('%d', page.toString());
            const response = await fetch('https://graphql.canopyapi.co/', {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    'API-KEY': process.env.CANOPY_API_KEY,
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Check if we have valid results
            if (result.data && 
                result.data.amazonProductCategory && 
                result.data.amazonProductCategory.productResults && 
                result.data.amazonProductCategory.productResults.results) {
                
                const newProducts = result.data.amazonProductCategory.productResults.results;
                let addedCount = 0;
                let duplicateCount = 0;
                
                // Filter out products with duplicate ASINs
                const uniqueNewProducts = newProducts.filter(product => {
                    if (processedAsins.has(product.asin)) {
                        duplicateCount++;
                        return false;
                    } else {
                        processedAsins.add(product.asin);
                        addedCount++;
                        return true;
                    }
                });
                
                // Append unique new products to existing results
                allResults.data.amazonProductCategory.productResults.results = [
                    ...allResults.data.amazonProductCategory.productResults.results,
                    ...uniqueNewProducts
                ];
                
                console.log(`Page ${page}: Added ${addedCount} new products, skipped ${duplicateCount} duplicates. Total products: ${allResults.data.amazonProductCategory.productResults.results.length}`);
                
                // Write the updated results to file after each successful page fetch
                fs.writeFileSync(filePath, JSON.stringify(allResults, null, 2));
                console.log(`Updated file with data from page ${page}`);
                
                // Check if there are no more pages
                if (result.data.amazonProductCategory.productResults.pageInfo && 
                    !result.data.amazonProductCategory.productResults.pageInfo.hasNextPage) {
                    console.log(`No more pages available after page ${page}. Stopping.`);
                    break;
                }
            } else {
                console.warn(`No valid results found on page ${page}`);
            }
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error.message);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
            // Continue with next page even if current page fails
        }
    }

    console.log(`Completed fetching data. Total unique products: ${allResults.data.amazonProductCategory.productResults.results.length}`);
    return allResults;
}

fetchAmazonData()
    .then(result => console.log('Data from Amazon received and saved successfully!'))
    .catch(error => {
        console.error('Failed to complete Amazon data operation:', error.message);
        process.exit(1);
    });
