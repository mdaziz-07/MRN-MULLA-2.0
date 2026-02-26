/**
 * MRN Mulla Kirana – Kiko Product Importer (Name + Price only)
 * 
 * Step 1: Deletes ALL existing products
 * Step 2: Fetches all 305 products from Kiko (fetches pages until no more items)
 * Step 3: Inserts name + price into Supabase
 *
 * Run: node scripts/import-kiko-products.mjs
 */

import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://vkbhvzgcnagxyhoiuaoj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dPTk3YsvJLI-xcgrhps_RA_zWBYl9K9'
const KIKO_SELLER_ID = '69298771bc54dbb080aaddbe'
const KIKO_API = 'https://ondc.kiko.live/ondc-seller/catalogues-group-by-categories'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── STEP 1: Delete all existing products ─────────────────────────────────
async function deleteAllProducts() {
    console.log('🗑️  Deleting all existing products...')
    // Delete where id > 0 (deletes everything)
    const { error } = await supabase
        .from('products')
        .delete()
        .gte('id', 0)   // matches all rows

    if (error) {
        // Try alternate: delete where id is not null
        const { error: e2 } = await supabase
            .from('products')
            .delete()
            .not('id', 'is', null)
        if (e2) {
            console.error('❌ Delete failed:', e2.message)
            process.exit(1)
        }
    }
    console.log('   ✅ All products deleted.\n')
}

// ─── STEP 2: Fetch all pages from Kiko ────────────────────────────────────
async function fetchAllKikoProducts() {
    const all = []
    let page = 1

    while (true) {
        console.log(`📦 Fetching page ${page}...`)
        const res = await fetch(KIKO_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: 'All',
                sellerId: KIKO_SELLER_ID,
                sortBy: 0,
                subCategoryId: 'All',
                page,
            }),
        })

        if (!res.ok) {
            console.error(`❌ HTTP ${res.status} on page ${page}`)
            break
        }

        const json = await res.json()
        const items = json?.data?.results || []

        if (items.length === 0) {
            console.log(`   ℹ️  No more items on page ${page}. Done fetching.`)
            break
        }

        console.log(`   ✅ ${items.length} items (total so far: ${all.length + items.length})`)
        all.push(...items)
        page++

        // Safety cap: if we've fetched more than the known total, stop
        const total = json?.data?.catalogueCount || 999
        if (all.length >= total) {
            console.log(`   ✅ Reached catalogue total (${total}). Done fetching.`)
            break
        }
    }

    return all
}

// ─── STEP 3: Insert name + price only ─────────────────────────────────────
async function insertProducts(raw) {
    // Map to only name + price
    const products = raw
        .map(item => ({
            name: (item.productName || '').trim(),
            price: Number(item.discountedPrice || item.price || 0),
            mrp: Number(item.price || 0),
            // Required fields that need a value so DB doesn't reject:
            category: 'Other',
            pack_size: '',
            unit: 'pc',
            stock: Number(item.availableQuantity || 10),
            image_url: item.productImages?.[0] || '',
            barcode: '',
        }))
        .filter(p => p.name)   // skip blank names

    console.log(`\n🚀 Inserting ${products.length} products (name + price)...`)

    const BATCH = 50
    let done = 0

    for (let i = 0; i < products.length; i += BATCH) {
        const batch = products.slice(i, i + BATCH)
        const { error } = await supabase.from('products').insert(batch)
        if (error) {
            console.error(`❌ Batch ${Math.floor(i / BATCH) + 1} error:`, error.message)
        } else {
            done += batch.length
            console.log(`   ✅ Batch ${Math.floor(i / BATCH) + 1} done (${done}/${products.length})`)
        }
    }

    return done
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
; (async () => {
    console.log('══════════════════════════════════════════')
    console.log('  MRN Mulla – Kiko Importer (Name+Price)')
    console.log('══════════════════════════════════════════\n')

    await deleteAllProducts()

    const raw = await fetchAllKikoProducts()
    console.log(`\n📊 Total fetched from Kiko: ${raw.length}`)

    const count = await insertProducts(raw)

    console.log(`\n✅ Done! ${count} products added to Supabase.`)
    console.log('   Open Admin App → Products to verify.\n')
})()
