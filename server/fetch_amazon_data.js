import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Validate that API key exists
if (!process.env.CANOPY_API_KEY) {
    throw new Error('CANOPY_API_KEY environment variable is not set');
}

async function fetchAmazonData() {
    const query = `
        query amazonProduct {
            amazonProductCategory(input: {categoryId: "172500", domain: US }) {
            productResults {
                results {
                    title
                    url
                    asin
                    brand
                    isNew
                    rating
                    ratingsTotal
                    featureBullets
                    price {
                        value
                        symbol
                    }
                    technicalSpecifications {
                        name
                        value
                    }
                    stockEstimate {
                        availabilityMessage
                        inStock
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
        const dir = '../public/data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync('../public/data/amazon-query-result.json', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('Error fetching Amazon data:', error);
        throw error;
    }
}

fetchAmazonData()
    .then(result => console.log('Data from Amazon received!'))
    .catch(error => {
        console.error('Failed to fetch Amazon data:', error);
        process.exit(1);
    });
