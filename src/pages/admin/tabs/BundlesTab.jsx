import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Search, Package, Save, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { PRODUCTS } from '../../../data/products'

export default function BundlesTab() {
    const [loading, setLoading] = useState(false)
    const [bundles, setBundles] = useState([]) // Array of bundle objects { id, name, items: [product_ids] }

    // Bundle creation state
    const [isCreating, setIsCreating] = useState(false)
    const [bundleName, setBundleName] = useState('')
    const [selectedProducts, setSelectedProducts] = useState([]) // array of product IDs
    const [searchQuery, setSearchQuery] = useState('')
    const [allProducts, setAllProducts] = useState(PRODUCTS)

    useEffect(() => {
        fetchProducts()
        fetchBundles()
    }, [])

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('*').order('name')
        if (data) setAllProducts(data)
    }

    const fetchBundles = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('store_settings')
            .select('value')
            .eq('key', 'product_bundles')
            .single()

        if (data && data.value) {
            try {
                setBundles(JSON.parse(data.value))
            } catch (e) {
                console.error("Failed to parse bundles", e)
                setBundles([])
            }
        }
        setLoading(false)
    }

    const saveBundlesToDB = async (newBundles) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('store_settings')
                .upsert({ key: 'product_bundles', value: JSON.stringify(newBundles) }, { onConflict: 'key' })

            if (error) throw error
            setBundles(newBundles)
            toast.success('Bundles saved successfully!')
        } catch (err) {
            console.error(err)
            toast.error('Failed to save bundles')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateBundle = () => {
        if (!bundleName.trim() || selectedProducts.length < 2) {
            toast.error('Please enter a name and select at least 2 products.')
            return
        }

        const newBundle = {
            id: Date.now().toString(),
            name: bundleName.trim(),
            items: selectedProducts
        }

        const updatedBundles = [...bundles, newBundle]
        saveBundlesToDB(updatedBundles)

        // Reset form
        setIsCreating(false)
        setBundleName('')
        setSelectedProducts([])
        setSearchQuery('')
    }

    const handleDeleteBundle = (id) => {
        if (confirm('Are you sure you want to delete this bundle?')) {
            const updatedBundles = bundles.filter(b => b.id !== id)
            saveBundlesToDB(updatedBundles)
        }
    }

    const toggleProductSelection = (productId) => {
        setSelectedProducts(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        )
    }

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return allProducts
        const q = searchQuery.toLowerCase().replace(/\s+/g, '')
        return allProducts.filter(p => p.name.toLowerCase().replace(/\s+/g, '').includes(q))
    }, [allProducts, searchQuery])

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <Package className="text-[#023430]" /> Product Bundles
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Group items together to show as "Frequently Bought Together" suggestions at checkout.
                    </p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-[#023430] text-white px-5 py-2.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                        <Plus size={18} /> Create Bundle
                    </button>
                )}
            </div>

            {/* Creation Form */}
            {isCreating && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#023430]/20 max-h-[75vh] flex flex-col animate-slideUp">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 shrink-0">Create New Bundle</h2>

                    <div className="mb-4 shrink-0">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bundle Name</label>
                        <input
                            type="text"
                            value={bundleName}
                            onChange={(e) => setBundleName(e.target.value)}
                            placeholder="e.g. Breakfast Combo, Monthly Groceries"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-[#023430] focus:ring-0 outline-none transition-colors font-medium"
                        />
                    </div>

                    {/* Selected Products Summary */}
                    {selectedProducts.length > 0 && (
                        <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-200 shrink-0">
                            <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">Selected Items ({selectedProducts.length})</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedProducts.map(id => {
                                    const prod = allProducts.find(p => p.id === id)
                                    if (!prod) return null
                                    return (
                                        <div key={id} className="bg-white border border-green-300 text-green-900 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm group">
                                            <span className="truncate max-w-[120px]">{prod.name}</span>
                                            <span className="font-bold text-green-700">₹{prod.price}</span>
                                            <button
                                                onClick={() => toggleProductSelection(id)}
                                                className="w-4 h-4 rounded-full hover:bg-red-100 text-green-700 hover:text-red-600 flex items-center justify-center transition-colors"
                                            >
                                                <X size={12} strokeWidth={3} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mb-3 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center shrink-0">
                        <label className="block text-sm font-semibold text-gray-700">
                            Select Products
                        </label>
                        <div className="relative w-full sm:w-64">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm outline-none border border-gray-200 focus:border-[#023430]"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-[150px] border border-gray-200 rounded-xl p-2 mb-4 bg-gray-50">
                        {filteredProducts.map(product => {
                            const isSelected = selectedProducts.includes(product.id)
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => toggleProductSelection(product.id)}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors mb-1
                                        ${isSelected ? 'bg-green-100 border border-green-300' : 'bg-white hover:bg-gray-100 border border-transparent'}
                                    `}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        readOnly
                                        className="w-4 h-4 text-[#023430] rounded"
                                    />
                                    <div className="w-10 h-10 bg-white rounded flex items-center justify-center p-1 shrink-0">
                                        <img src={product.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-1">
                                        <p className="text-sm font-bold text-gray-900 break-words leading-tight line-clamp-2 mb-0.5">{product.name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">{product.category} • ₹{product.price}</p>
                                    </div>
                                </div>
                            )
                        })}
                        {filteredProducts.length === 0 && (
                            <div className="p-4 text-center text-gray-500 text-sm">No products found</div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end shrink-0 pt-2 border-t border-gray-100">
                        <button
                            onClick={() => {
                                setIsCreating(false)
                                setBundleName('')
                                setSelectedProducts([])
                            }}
                            className="px-5 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateBundle}
                            disabled={loading || selectedProducts.length < 2 || !bundleName}
                            className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#023430] hover:bg-[#034540] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                            Save Bundle
                        </button>
                    </div>
                </div>
            )}

            {/* Existing Bundles List */}
            {!isCreating && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bundles.length === 0 ? (
                        <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-gray-300">
                            <Package size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No Bundles Yet</h3>
                            <p className="text-sm text-gray-500">Create your first bundle to show suggestions to customers.</p>
                        </div>
                    ) : (
                        bundles.map(bundle => (
                            <div key={bundle.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-base font-black text-gray-900 leading-tight">
                                        {bundle.name}
                                    </h3>
                                    <button
                                        onClick={() => handleDeleteBundle(bundle.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Bundle"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="flex-1 space-y-2 mb-4">
                                    {bundle.items.map(itemId => {
                                        const product = allProducts.find(p => p.id === itemId)
                                        if (!product) return null
                                        return (
                                            <div key={itemId} className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-gray-50 rounded p-0.5 shrink-0">
                                                    <img src={product.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                                </div>
                                                <span className="text-xs font-semibold text-gray-700 truncate">{product.name}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-auto pt-3 border-t border-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {bundle.items.length} Products
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
