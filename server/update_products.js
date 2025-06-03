import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
const LOG_FILE = path.join(__dirname, '../logs/update_products.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

/**
 * Write a log message to both console and log file
 * @param {string} message - The message to log
 * @param {'info' | 'error' | 'warning'} level - Log level
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Write to console with color
  const colors = {
    info: '\x1b[32m',    // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m'  // Yellow
  };
  console.log(`${colors[level]}${message}\x1b[0m`);
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage);
}

/**
 * Check if required environment variables are set
 * @returns {boolean}
 */
function validateEnvironment() {
  const envFile = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envFile)) {
    log('.env file not found in project root', 'error');
    return false;
  }
  
  if (!process.env.CANOPY_API_KEY) {
    log('CANOPY_API_KEY not found in environment variables', 'error');
    log('Please ensure your .env file contains a valid CANOPY_API_KEY', 'error');
    return false;
  }
  
  return true;
}

/**
 * Check if required data directories exist and are writable
 * @returns {boolean}
 */
function validateDataDirectories() {
  const dataDir = path.join(__dirname, '../public/data');
  
  try {
    if (!fs.existsSync(dataDir)) {
      log(`Creating data directory: ${dataDir}`, 'info');
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Test write permissions
    const testFile = path.join(dataDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return true;
  } catch (error) {
    log(`Error accessing data directory: ${error.message}`, 'error');
    log(`Please ensure the following directory exists and is writable: ${dataDir}`, 'error');
    return false;
  }
}

/**
 * Executes a command and returns a promise that resolves when the command completes
 * @param {string} command - The command to execute
 * @param {string} description - Description of the command for logging
 * @returns {Promise<void>}
 */
function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    log(`Starting: ${description}`, 'info');
    
    const childProcess = exec(command, { cwd: __dirname });
    let output = '';
    let errorOutput = '';
    
    // Capture stdout and stderr
    childProcess.stdout.on('data', (data) => {
      output += data;
      process.stdout.write(data);
    });
    
    childProcess.stderr.on('data', (data) => {
      errorOutput += data;
      process.stderr.write(data);
    });
    
    childProcess.on('exit', (code) => {
      if (code === 0) {
        log(`Completed: ${description}`, 'info');
        resolve();
      } else {
        const errorMessage = `Command failed with exit code ${code}`;
        log(`${description} failed: ${errorMessage}`, 'error');
        log('Error output:', 'error');
        log(errorOutput, 'error');
        reject(new Error(errorMessage));
      }
    });
    
    childProcess.on('error', (err) => {
      const errorMessage = `Failed to execute command: ${err.message}`;
      log(`${description} failed: ${errorMessage}`, 'error');
      log('Error output:', 'error');
      log(errorOutput, 'error');
      reject(new Error(errorMessage));
    });
  });
}

/**
 * Validates the generated data files
 * @returns {boolean}
 */
function validateDataFiles() {
  const files = [
    { path: '../public/data/memory-cards.json', name: 'Memory Cards Data' },
    { path: '../public/data/product-filters.json', name: 'Product Filters' }
  ];
  
  for (const file of files) {
    const filePath = path.join(__dirname, file.path);
    
    try {
      if (!fs.existsSync(filePath)) {
        log(`${file.name} file not found: ${filePath}`, 'error');
        return false;
      }
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!data || (Array.isArray(data.data) && data.data.length === 0)) {
        log(`${file.name} file is empty or invalid: ${filePath}`, 'warning');
        return false;
      }
      
      log(`${file.name} file validated successfully`, 'info');
    } catch (error) {
      log(`Error validating ${file.name} file: ${error.message}`, 'error');
      return false;
    }
  }
  
  return true;
}

/**
 * Main function that runs all steps sequentially
 */
async function updateProducts() {
  const startTime = Date.now();
  
  try {
    log('Starting product update process...', 'info');
    
    // Validate environment and directories
    if (!validateEnvironment() || !validateDataDirectories()) {
      throw new Error('Validation failed. Please check the logs for details.');
    }
    
    // Step 1: Fetch Amazon data
    await executeCommand('node fetch_amazon_data.js', 'Fetching Amazon data');
    
    // Step 2: Convert Amazon memory cards data
    await executeCommand('node convert_amazon_memory_cards_data.js', 'Converting Amazon memory cards data');
    
    // Step 3: Generate product filters
    await executeCommand('node generate-product-filters.js', 'Generating product filters');
    
    // Validate generated data files
    if (!validateDataFiles()) {
      throw new Error('Data file validation failed. Please check the logs for details.');
    }
    
    // Step 4: Build the project
    await executeCommand('cd .. && npm run build', 'Building the project');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    log(`Product update process completed successfully in ${duration} minutes`, 'info');
  } catch (error) {
    log(`Product update process failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the update process
updateProducts(); 