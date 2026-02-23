const fs = require('fs');
let data = fs.readFileSync('src/data/products.js', 'utf8');
data = data.replace(/image_url:\s*'[^']+'/g, "image_url: ''");
fs.writeFileSync('src/data/products.js', data);
console.log('Restored products.js and only cleared image_url, skipping category images.');
