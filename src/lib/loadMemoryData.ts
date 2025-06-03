import fs from 'fs';
import path from 'path';

export function getLastUpdate(): string {
    try {
        const filePath = path.resolve('public/data/memory-cards.json');
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(rawData);
        return data.date || 'Unknown';
    } catch (error) {
        console.error('Error loading memory cards data:', error);
        return 'Unknown';
    }
} 