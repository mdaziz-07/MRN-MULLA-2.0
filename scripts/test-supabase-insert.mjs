// Print the exact Supabase error
const SUPABASE_URL = 'https://vkbhvzgcnagxyhoiuaoj.supabase.co'
const SUPABASE_KEY = 'sb_secret_RArbNCltgsRdjeePeSo55Q_hS7L3gg5'

const testProduct = {
    name: 'Test Product',
    category: 'Other',
    price: 10,
    mrp: 10,
    pack_size: '1',
    unit: 'pc',
    stock: 5,
    image_url: '',
    barcode: '',
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=ignore-duplicates',
    },
    body: JSON.stringify([testProduct]),
})

console.log('Status:', res.status)
console.log('Body:', await res.text())
