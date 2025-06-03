const fs = require('fs');
const path = require('path');

// Read the JSON file
const filePath = path.join(__dirname, '..', 'public', 'data', 'memory-cards.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Function to clean device list from JavaScript function
function cleanDeviceList(str) {
    if (typeof str !== 'string') return str;
    if (str.includes('function(f)')) {
        // Extract the device list from the string
        const match = str.match(/DS\d+\+|DS\d+xs\+|DS\d+|RS\d+\+|RS\d+RP\+|DVA\d+|FS\d+/g);
        return match ? match.join(', ') : 'NAS Device';
    }
    return str;
}

// Clean the data
data.data = data.data.map(item => ({
    ...item,
    compatible_devices: cleanDeviceList(item.compatible_devices),
    link_title: item.link_title.includes('function(f)') 
        ? `${item.brand} ${item.computer_memory_size}GB ${item.computer_memory_type} Memory ${item.ram_memory_technology} ${item.memory_speed}MHz${item.latency !== 'N/A' ? ' ' + item.latency : ''}`
        : item.link_title
}));

// Write the cleaned data back to the file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

console.log('Data cleaned successfully!'); 