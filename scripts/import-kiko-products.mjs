/**
 * MRN Mulla Kirana – Kiko Product Importer
 * Run: node scripts/import-kiko-products.mjs
 * (Uses @supabase/supabase-js which is already installed in node_modules)
 */

import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://vkbhvzgcnagxyhoiuaoj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dPTk3YsvJLI-xcgrhps_RA_zWBYl9K9'
const KIKO_SELLER_ID = '69298771bc54dbb080aaddbe'
const KIKO_API = 'https://ondc.kiko.live/ondc-seller/catalogues-group-by-categories'
const TOTAL_PAGES = 4

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Kiko subCategoryId → app category
const CATEGORY_MAP = {
    'Atta, Flours and Sooji': 'Atta & Flour',
    'Cereals and Breakfast': 'Atta & Flour',
    'Cooking and Baking Needs': 'Atta & Flour',
    'Rice and Rice Products': 'Rice & Dal',
    'Dals and Pulses': 'Rice & Dal',
    'Salt, Sugar and Jaggery': 'Rice & Dal',
    'Eggs, Meat & Fish': 'Rice & Dal',
    'Oil & Ghee': 'Cooking Oil & Ghee',
    'Masala & Seasoning': 'Spices & Masala',
    'Sauces, Spreads and Dips': 'Spices & Masala',
    'Pickles and Chutney': 'Spices & Masala',
    'Tea and Coffee': 'Tea & Coffee',
    'Chocolates and Biscuits': 'Chocolates & Biscuits',
    'Bakery, Cakes & Dairy': 'Chocolates & Biscuits',
    'Indian Sweets': 'Snacks & Namkeen',
    'Snacks and Namkeen': 'Snacks & Namkeen',
    'Pasta, Soup and Noodles': 'Snacks & Namkeen',
    'Fruit Juices and Fruit Drinks': 'Fruit Juice & Energy Drinks',
    'Energy and Soft Drinks': 'Fruit Juice & Energy Drinks',
    'Detergents and Dishwash': 'Soaps & Detergent',
    'Cleaning & Household': 'Cleaning & Household',
    'Pet Care': 'Cleaning & Household',
    'Stationery': 'Stationery',
}

async function fetchKikoProducts() {
    const all = []
    for (let page = 1; page <= TOTAL_PAGES; page++) {
        console.log(`📦 Fetching page ${page}/${TOTAL_PAGES}...`)
        const res = await fetch(KIKO_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: 'All', sellerId: KIKO_SELLER_ID,
                sortBy: 0, subCategoryId: 'All', page,
            }),
        })
        if (!res.ok) { console.error(`❌ HTTP ${res.status}`); continue }
        const json = await res.json()
        const items = json?.data?.results || []
        if (items.length === 0) { console.log(`   ℹ️ No more items.`); break }
        console.log(`   ✅ ${items.length} items`)
        all.push(...items)
    }
    return all
}

function mapProduct(item) {
    const rawCat = (item.subCategoryId || '').trim()
    const category = CATEGORY_MAP[rawCat] || 'Other'
    const price = Number(item.discountedPrice || item.price || 0)
    const mrp = Number(item.price || price)
    const image_url = item.productImages?.[0] || ''
    const pack_size = item.weight ? String(item.weight) : ''
    const unitRaw = (item.weightUnit || '').toUpperCase()
    const unit = unitRaw === 'GRAMS' ? 'g'
        : unitRaw === 'ML' ? 'ml'
            : unitRaw === 'KG' ? 'kg'
                : 'pc'
    return {
        name: (item.productName || '').trim(),
        category,
        price,
        mrp,
        pack_size,
        unit,
        stock: Number(item.availableQuantity || 20),
        image_url,
        barcode: item.barcode || '',
    }
}

async function upsertToSupabase(products) {
    console.log(`\n🚀 Inserting ${products.length} products...`)
    const BATCH = 50
    let done = 0
    for (let i = 0; i < products.length; i += BATCH) {
        const batch = products.slice(i, i + BATCH)
        const { error } = await supabase.from('products').upsert(batch, { ignoreDuplicates: true })
        if (error) {
            console.error(`❌ Batch ${Math.floor(i / BATCH) + 1} error:`, error.message)
        } else {
            done += batch.length
            console.log(`   ✅ Batch ${Math.floor(i / BATCH) + 1} done (${done}/${products.length})`)
        }
    }
    return done
}

; (async () => {
    console.log('══════════════════════════════════════')
    console.log('  MRN Mulla – Kiko Product Importer')
    console.log('══════════════════════════════════════\n')

    const raw = await fetchKikoProducts()
    console.log(`\n📊 Total fetched: ${raw.length}`)

    const mapped = raw.map(mapProduct).filter(p => p.name)
    console.log(`📝 Valid: ${mapped.length}`)

    console.log('\n📋 Preview (first 5):')
    mapped.slice(0, 5).forEach((p, i) =>
        console.log(`  ${i + 1}. ${p.name} | ${p.category} | ₹${p.price}`)
    )

    const count = await upsertToSupabase(mapped)
    console.log(`\n✅ Done! ${count} products inserted. Open Admin App → Products to verify.\n`)
})()
