// Quick debug: print the raw Kiko API response structure
import fs from 'fs'

const res = await fetch('https://ondc.kiko.live/ondc-seller/catalogues-group-by-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        category: 'All',
        sellerId: '69298771bc54dbb080aaddbe',
        sortBy: 0,
        subCategoryId: 'All',
        page: 1,
    }),
})

const json = await res.json()
fs.writeFileSync('scripts/kiko-raw.json', JSON.stringify(json, null, 2))
console.log('Written to scripts/kiko-raw.json')
console.log('Top-level keys:', Object.keys(json))
