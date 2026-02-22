import fs from 'fs';
import path from 'path';

const appType = process.argv[2]; // 'customer' or 'admin'

if (!appType) {
    console.error('Please specify app type: customer or admin');
    process.exit(1);
}

const sourceFile = path.join(process.cwd(), 'assets', appType, 'icon.png');
const destFile = path.join(process.cwd(), 'assets', 'icon.png');

if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, destFile);
    console.log(`✅ Successfully copied ${appType} logo to assets/icon.png`);
} else {
    console.warn(`⚠️ Warning: No specific logo found at ${sourceFile}.`);
    console.warn(`Please place your 1024x1024 icon.png in the assets/${appType}/ folder.`);
}
