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
    const query = `
query amazonProduct {
  amazonProductCategory(input: {categoryId: "172500", domain: US}) {
    productResults(input: {page: "1", sort: AVERAGE_CUSTOMER_REVIEW}) {
      pageInfo {
        hasNextPage
        hasPrevPage
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
        }
        bestSellerRankings {
          categoryName
          rank
        }
        categories {
          id
          name
        }
      }
    }
  }
}
`;

    try {
        const response = await fetch('https://graphql.canopyapi.co/', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'API-KEY': process.env.CANOPY_API_KEY,
            },
            body: JSON.stringify({query}),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Ensure the directory exists before writing
        const dir = path.join(__dirname, '../public/data');
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (dirError) {
            throw new Error(`Failed to create directory ${dir}: ${dirError.message}`);
        }

        // Write the file with proper error handling
        const filePath = path.join(dir, 'amazon-query-result.json');
        try {
            fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
            console.log(`Successfully wrote data to ${filePath}`);
        } catch (writeError) {
            throw new Error(`Failed to write file ${filePath}: ${writeError.message}`);
        }

        return result;
    } catch (error) {
        console.error('Error in fetchAmazonData:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        throw error;
    }
}

fetchAmazonData()
    .then(result => console.log('Data from Amazon received and saved successfully!'))
    .catch(error => {
        console.error('Failed to complete Amazon data operation:', error.message);
        process.exit(1);
    });
