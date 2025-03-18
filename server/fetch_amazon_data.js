import fs from 'fs';
import fetch from 'node-fetch';

const AMAZON_API_URL = "https://api.example.com/amazon/memory-cards"; // Replace with actual Amazon API

async function fetchMemoryCards() {
    try {
        const response = await fetch(AMAZON_API_URL);
        const data = await response.json();

        fs.writeFileSync("public/data/memory-cards.json", JSON.stringify(data, null, 2));
        console.log("✅ Amazon data updated");

        // Trigger Astro rebuild
        console.log("🚀 Rebuilding site...");
        require("child_process").execSync("npm run build");
    } catch (error) {
        console.error("❌ Error fetching Amazon data:", error);
    }
}

fetchMemoryCards();
