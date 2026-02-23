const fs = require('fs');
let data = fs.readFileSync('src/data/products.js', 'utf8');
data = data.replace(/image_url:\s*'[^']+'/g, "image_url: ''");
// Also there's image: '...' for categories that the user might want left alone, wait, the user said "links that are in product.js, this type of link: https://m.media-amazon.com/..." 
// So yes, we can regex all of them.
data = data.replace(/image:\s*'[^']+'/g, "image: ''");
fs.writeFileSync('src/data/products.js', data);
console.log('Done replacing image URLs.');
