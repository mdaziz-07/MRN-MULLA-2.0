import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Plus, Edit, Trash2, Search,
    X, Upload, Save, ScanBarcode
} from 'lucide-react'
import { supabase, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../../../lib/supabase'
import { PRODUCTS, CATEGORIES } from '../../../data/products'
import { toast } from 'sonner'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'

export default function ProductsTab({ selectedCategory: parentCategory, setSelectedCategory: parentSetCategory }) {
    const [products, setProducts] = useState(PRODUCTS)
    const [categories, setCategories] = useState(
        CATEGORIES.filter(c => c.name !== 'All').map(c => c.name)
    )
    // Use parent-controlled selectedCategory if provided (for hamburger menu)
    const [localCategory, setLocalCategory] = useState('')
    const selectedCategory = parentCategory !== undefined ? parentCategory : localCategory
    const setSelectedCategory = parentSetCategory || setLocalCategory
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [scannedBarcode, setScannedBarcode] = useState('')

    // Try to fetch from Supabase
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('category')

                if (error) throw error
                if (data && data.length > 0) setProducts(data)
            } catch (err) {
                console.log('Using local product data')
            }
        }
        fetchProducts()
    }, [])

    // Filtered products
    const filteredProducts = useMemo(() => {
        let result = products
        if (selectedCategory) {
            result = result.filter(p => p.category === selectedCategory)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().replace(/\s+/g, '')
            result = result.filter(p =>
                p.name.toLowerCase().replace(/\s+/g, '').includes(q) ||
                p.category.toLowerCase().replace(/\s+/g, '').includes(q) ||
                (p.barcode && p.barcode.toLowerCase().replace(/\s+/g, '').includes(q))
            )
        }
        result.sort((a, b) => a.name.localeCompare(b.name))
        return result
    }, [products, selectedCategory, searchQuery])

    // Delete product
    const deleteProduct = async (productId) => {
        if (!confirm('Delete this product?')) return

        try {
            await supabase.from('products').delete().eq('id', productId)
        } catch (e) {
            // Local delete
        }

        setProducts(prev => prev.filter(p => p.id !== productId))
        toast.success('Product deleted')
    }

    // Save product (add or edit)
    const saveProduct = async (productData) => {
        if (editingProduct) {
            // Update
            try {
                await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
            } catch (e) { /* local */ }

            setProducts(prev =>
                prev.map(p => p.id === editingProduct.id ? { ...p, ...productData } : p)
            )
            toast.success('Product updated!')
        } else {
            // Add new
            const newProduct = {
                ...productData,
                id: Math.max(...products.map(p => p.id), 0) + 1,
            }

            try {
                const { data } = await supabase.from('products').insert([productData]).select()
                if (data?.[0]) newProduct.id = data[0].id
            } catch (e) { /* local */ }

            setProducts(prev => [...prev, newProduct])
            toast.success('Product added!')
        }

        setShowAddModal(false)
        setEditingProduct(null)
    }

    // Handle barcode scan result mapping
    const handleBarcodeScan = useCallback((barcode) => {
        setScannedBarcode(barcode)

        // Check if product with this barcode exists
        const existingProduct = products.find(p =>
            p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase()
        )

        if (existingProduct) {
            // Product exists — open update popup
            toast.info(`Product found: ${existingProduct.name}`)
            setEditingProduct(existingProduct)
            setShowAddModal(true)
        } else {
            // New barcode — open add popup with barcode pre-filled
            toast.info('New product! Fill in the details.')
            setEditingProduct(null)
            setShowAddModal(true)
        }
    }, [products])

    // Native Google Scanner trigger
    const startNativeScan = async () => {
        try {
            // 1. Request Permission
            const { camera } = await BarcodeScanner.requestPermissions()
            if (camera !== 'granted') {
                return toast.error('Camera permission denied')
            }

            // 2. Open the Official Google Native Scanner Window
            const { barcodes } = await BarcodeScanner.scan()

            if (barcodes && barcodes.length > 0) {
                const scannedCode = barcodes[0].rawValue
                handleBarcodeScan(scannedCode)
            }
        } catch (err) {
            console.error('Scan error:', err)
            // User cancelled or plugin failed
        }
    }

    return (
        <div className="space-y-4">
            {/* ─── Search & Controls ─── */}
            <div className="flex justify-between items-center gap-2">
                <div className="bg-white flex-1 rounded-xl px-4 py-2.5 flex items-center border border-gray-100 shadow-sm">
                    <Search size={18} className="text-gray-400" />
                    <input
                        placeholder="Search inventory..."
                        className="bg-transparent w-full ml-3 text-sm font-medium outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="bg-gray-100 px-3 py-2 rounded-lg text-xs font-bold text-gray-500 shrink-0">
                    {filteredProducts.length} Items
                </div>
                <button
                    onClick={startNativeScan}
                    className="bg-white border border-gray-200 text-gray-700 p-2.5 rounded-full shadow-sm hover:bg-gray-50 transition-all"
                    title="Scan Barcode"
                >
                    <ScanBarcode size={22} />
                </button>
                <button
                    onClick={() => { setEditingProduct(null); setScannedBarcode(''); setShowAddModal(true) }}
                    className="bg-black text-white p-2.5 rounded-full shadow-lg hover:bg-gray-800 transition-all"
                >
                    <Plus size={22} />
                </button>
            </div>

            {/* ─── Category Chips (hidden on mobile — shown in hamburger menu) ─── */}
            <div className="hidden lg:flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <button
                    onClick={() => { setSelectedCategory(''); setSearchQuery('') }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                        ${!selectedCategory ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600'}
                    `}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setSearchQuery('') }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                            ${selectedCategory === cat && !searchQuery
                                ? 'bg-black text-white'
                                : 'bg-white border border-gray-200 text-gray-600'
                            }
                        `}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* ─── Product List ─── */}
            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className="bg-white p-3 rounded-2xl shadow-sm flex items-center justify-between border border-gray-100 hover:border-gray-300 transition-all hover:shadow-md"
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="h-16 w-16 rounded-xl bg-gray-50 border flex items-center justify-center p-1 shrink-0">
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="h-full w-full object-contain mix-blend-multiply"
                                        loading="lazy"
                                        onError={(e) => {
                                            e.target.onerror = null
                                            e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f5f5f5' width='100' height='100' rx='8'/><text x='50' y='55' text-anchor='middle' fill='%23999' font-size='10'>${encodeURIComponent(product.name.slice(0, 8))}</text></svg>`
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">
                                        {product.name}
                                    </h4>
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 uppercase tracking-wide">
                                            Stock: {product.stock}
                                        </span>
                                        {product.barcode && (
                                            <span className="text-[10px] font-mono bg-blue-50 px-2 py-1 rounded text-blue-600">
                                                {product.barcode}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 ml-2">
                                <div className="text-right">
                                    <span className="font-bold text-lg text-gray-900 block">₹{product.price}</span>
                                    {product.mrp && product.mrp > product.price && (
                                        <span className="text-[10px] text-gray-400 font-bold">MRP: ₹{product.mrp}</span>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => { setEditingProduct(product); setScannedBarcode(''); setShowAddModal(true) }}
                                        className="p-2.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => deleteProduct(product.id)}
                                        className="p-2.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="font-semibold text-[#1A1A1A]">No products</p>
                    <p className="text-sm text-[#757575]">Add products to this category</p>
                </div>
            )}

            {/* ─── Add/Edit Product Modal ─── */}
            {showAddModal && (
                <ProductFormModal
                    product={editingProduct}
                    categories={categories}
                    defaultCategory={selectedCategory}
                    scannedBarcode={scannedBarcode}
                    onSave={saveProduct}
                    onClose={() => { setShowAddModal(false); setEditingProduct(null); setScannedBarcode('') }}
                />
            )}
        </div>
    )
}

/* ─── Product Form Modal ─── */
function ProductFormModal({ product, categories, defaultCategory, scannedBarcode, onSave, onClose }) {
    // Parse existing images: support comma-separated URLs in image_url
    const parseImages = (prod) => {
        if (!prod) return []
        if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) return prod.images
        if (prod.image_url) return prod.image_url.split(',').map(u => u.trim()).filter(Boolean)
        return []
    }

    const [form, setForm] = useState({
        name: product?.name || '',
        category: product?.category || defaultCategory || categories[0] || '',
        price: product?.price || '',
        mrp: product?.mrp || '',
        pack_size: product?.pack_size || '',
        unit: product?.unit || 'g',
        stock: product?.stock || 0,
        barcode: product?.barcode || scannedBarcode || '',
        description: product?.description || '',
    })
    const [images, setImages] = useState(parseImages(product))
    const [imageUrlInput, setImageUrlInput] = useState('')
    const [uploading, setUploading] = useState(false)

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const addImageUrl = () => {
        const url = imageUrlInput.trim()
        if (!url) return
        setImages(prev => [...prev, url])
        setImageUrlInput('')
        toast.success('Image added!')
    }

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        e.target.value = '' // reset input

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                { method: 'POST', body: formData }
            )
            const data = await res.json()

            if (data.secure_url) {
                setImages(prev => [...prev, data.secure_url])
                toast.success('Image uploaded!')
            } else {
                toast.error('Upload failed: ' + (data.error?.message || 'Unknown error'))
            }
        } catch (err) {
            console.error('Cloudinary upload error:', err)
            toast.error('Image upload failed. Check your internet connection.')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.name.trim() || !form.price) {
            toast.error('Name and Price are required')
            return
        }
        onSave({
            ...form,
            price: Number(form.price),
            mrp: form.mrp ? Number(form.mrp) : null,
            stock: Number(form.stock),
            image_url: images.join(','),  // Store all images as comma-separated
        })
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white px-5 py-4 border-b border-[#E0E0E0] flex items-center justify-between z-10">
                    <h2 className="text-lg font-bold text-[#1A1A1A]">
                        {product ? 'Update Product' : 'Add New Product'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-[#F5F5F5] rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Barcode (shown prominently if scanned) */}
                    {(scannedBarcode || form.barcode) && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
                            <ScanBarcode size={20} className="text-blue-500 shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Barcode</p>
                                <p className="text-sm font-mono font-bold text-blue-700">{form.barcode}</p>
                            </div>
                        </div>
                    )}

                    {/* Multiple Images */}
                    <div>
                        <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                            Product Images ({images.length})
                        </label>

                        {/* Image Thumbnails */}
                        {images.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-3">
                                {images.map((url, i) => (
                                    <div key={i} className="relative group">
                                        <img
                                            src={url}
                                            alt={`Image ${i + 1}`}
                                            className="w-16 h-16 rounded-lg object-contain bg-gray-50 border border-gray-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                        >
                                            ×
                                        </button>
                                        {i === 0 && (
                                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center font-bold py-0.5 rounded-b-lg">
                                                MAIN
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add image URL */}
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="Paste image URL..."
                                className="input-field text-sm flex-1"
                                value={imageUrlInput}
                                onChange={(e) => setImageUrlInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                            />
                            <button
                                type="button"
                                onClick={addImageUrl}
                                disabled={!imageUrlInput.trim()}
                                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold disabled:opacity-30 hover:bg-gray-200 transition-colors"
                            >
                                Add
                            </button>
                        </div>

                        {/* Upload button */}
                        <label className="
                            flex items-center justify-center gap-2
                            py-2.5 rounded-lg
                            border-2 border-dashed border-[#E0E0E0]
                            text-sm text-[#757575]
                            cursor-pointer
                            hover:border-[#023430] hover:text-[#023430]
                            transition-colors
                        ">
                            <Upload size={16} />
                            {uploading ? 'Uploading...' : `Upload Image${images.length > 0 ? ' (+)' : ''}`}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                        </label>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                            Product Name *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Fortune Sunflower Oil"
                            className="input-field"
                            value={form.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            required
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                            Category *
                        </label>
                        <select
                            className="input-field"
                            value={form.category}
                            onChange={(e) => updateField('category', e.target.value)}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Price Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                                Selling Price *
                            </label>
                            <input
                                type="number"
                                placeholder="₹"
                                className="input-field"
                                value={form.price}
                                onChange={(e) => updateField('price', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                                MRP
                            </label>
                            <input
                                type="number"
                                placeholder="₹"
                                className="input-field"
                                value={form.mrp}
                                onChange={(e) => updateField('mrp', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Pack Size & Unit */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                                Pack Size
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 500"
                                className="input-field"
                                value={form.pack_size}
                                onChange={(e) => updateField('pack_size', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                                Unit
                            </label>
                            <select
                                className="input-field"
                                value={form.unit}
                                onChange={(e) => updateField('unit', e.target.value)}
                            >
                                {['g', 'kg', 'ml', 'L', 'pc', 'pcs', 'pack', 'slices'].map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Stock */}
                    <div>
                        <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                            Stock Quantity
                        </label>
                        <input
                            type="number"
                            placeholder="0"
                            className="input-field"
                            value={form.stock}
                            onChange={(e) => updateField('stock', e.target.value)}
                        />
                    </div>

                    {/* Barcode (if not already shown) */}
                    {!scannedBarcode && (
                        <div>
                            <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                                Barcode
                            </label>
                            <input
                                type="text"
                                placeholder="Scan or type barcode"
                                className="input-field"
                                value={form.barcode}
                                onChange={(e) => updateField('barcode', e.target.value)}
                            />
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5 block">
                            Description
                        </label>
                        <textarea
                            placeholder="Optional product description..."
                            className="input-field min-h-[80px] resize-y"
                            value={form.description}
                            onChange={(e) => updateField('description', e.target.value)}
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={uploading}
                        className="
                            w-full py-3.5 rounded-xl
                            bg-[#023430] text-white
                            font-bold text-base
                            active:scale-[0.98] transition-transform
                            shadow-lg disabled:opacity-50
                            flex items-center justify-center gap-2
                        "
                    >
                        <Save size={20} />
                        {product ? 'Update Product' : 'Add Product'}
                    </button>
                </form>
            </div>
        </div>
    )
}