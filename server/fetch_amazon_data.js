import fs from 'fs';
import fetch from 'node-fetch';

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

    const response = await fetch('https://graphql.canopyapi.co/', {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            'API-KEY': '173307e1-8df2-4374-b1dc-a0f99d9d290d',
        },
        body: JSON.stringify({query}),
    });

    const result = await response.json();
    console.log(result);
    fs.writeFileSync('../public/data/amazon-query-result.json', JSON.stringify(result, null, 2));
    return result;
}

fetchAmazonData().then(result => console.log('Data from Amazon received!')).catch(error => console.error(error));
