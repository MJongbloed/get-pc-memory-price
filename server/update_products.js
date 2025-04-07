import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes a command and returns a promise that resolves when the command completes
 * @param {string} command - The command to execute
 * @param {string} description - Description of the command for logging
 * @returns {Promise<void>}
 */
function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 ${description}...\n`);
    
    const childProcess = exec(command, { cwd: __dirname });
    
    // Forward stdout and stderr to the parent process
    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
    
    childProcess.on('exit', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${description} completed successfully\n`);
        resolve();
      } else {
        console.error(`\n❌ ${description} failed with code ${code}\n`);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    childProcess.on('error', (err) => {
      console.error(`\n❌ ${description} failed with error: ${err.message}\n`);
      reject(err);
    });
  });
}

/**
 * Main function that runs all steps sequentially
 */
async function updateProducts() {
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting product update process...');
    
    // Step 1: Fetch Amazon data
    await executeCommand('node fetch_amazon_data.js', 'Fetching Amazon data');
    
    // Step 2: Convert Amazon memory cards data
    await executeCommand('node convert_amazon_memory_cards_data.js', 'Converting Amazon memory cards data');
    
    // Step 3: Generate product filters (optional but helpful to have updated filters)
    await executeCommand('node generate-product-filters.js', 'Generating product filters');
    
    // Step 4: Build the project
    await executeCommand('cd .. && npm run build', 'Building the project');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    console.log(`\n🎉 Product update process completed successfully in ${duration} minutes`);
  } catch (error) {
    console.error(`\n💥 Product update process failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the update process
updateProducts(); 