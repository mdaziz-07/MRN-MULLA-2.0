import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Search, MapPin, ChevronRight, Plus, Minus, X,
    ShoppingCart, ClipboardList, Printer, Download, Map, LogIn
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import { PRODUCTS, CATEGORIES } from '../data/products'
import { STORE_NAME, STORE_LOCATION_TEXT, STORE_PHONE } from '../lib/supabase'
import ProductModal from '../components/ProductModal'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'

/* ─── Product Card (memoized) ─── */
const ProductCard = memo(function ProductCard({ product, isInCart, qty, onAdd, onIncrement, onDecrement, onOpenModal }) {
    const discount = product.mrp && product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 0

    return (
        <div
            onClick={() => onOpenModal(product)}
            className="
                bg-white rounded-xl p-2
                shadow-sm border border-gray-100
                flex flex-col h-full
                relative group
                hover:shadow-lg transition-all
                cursor-pointer
            "
        >
            {/* Image */}
            <div className="h-36 w-full flex items-center justify-center mb-2 bg-gray-50 rounded-lg p-2">
                <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-contain mix-blend-multiply"
                    loading="lazy"
                    onError={(e) => {
                        e.target.onerror = null
                        e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f0f0f0' width='100' height='100' rx='8'/><text x='50' y='55' text-anchor='middle' fill='%23999' font-size='14'>${encodeURIComponent(product.name.charAt(0))}</text></svg>`
                    }}
                />
            </div>

            {/* Product Info - flex-1 pushes price/button to bottom */}
            <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-800 line-clamp-2 h-10 mb-1 leading-snug">
                    {product.name}
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                    {product.pack_size} {product.unit}
                </p>
            </div>

            {/* Price & Action */}
            <div onClick={(e) => e.stopPropagation()}>
                <div className="text-base font-bold text-black mb-2">
                    ₹{product.price}
                    {product.mrp && product.mrp > product.price && (
                        <span className="text-xs text-[#BDBDBD] line-through ml-1">₹{product.mrp}</span>
                    )}
                </div>

                {!isInCart ? (
                    <button
                        onClick={() => onAdd(product)}
                        className="
                            w-full bg-[#023430] text-white
                            py-1.5 rounded-lg
                            font-bold
                            hover:bg-[#024a3b] transition-colors
                            flex items-center justify-center
                            active:scale-95 transition-transform
                        "
                        aria-label={`Add ${product.name} to cart`}
                    >
                        <Plus size={16} />
                    </button>
                ) : (
                    <div className="flex items-center justify-between bg-white border border-[#023430] rounded-lg h-7 px-1">
                        <button
                            onClick={() => onDecrement(product.id)}
                            className="text-[#023430]"
                            aria-label="Decrease quantity"
                        >
                            <Minus size={14} />
                        </button>
                        <span className="text-xs font-bold text-[#023430]">
                            {qty}
                        </span>
                        <button
                            onClick={() => onIncrement(product.id)}
                            className="text-[#023430]"
                            aria-label="Increase quantity"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Discount Badge - bottom left */}
            {discount > 0 && (
                <div className="
                    absolute top-2 left-2
                    px-2 py-0.5 rounded-md
                    bg-red-500 text-white
                    text-[10px] font-bold
                    pointer-events-none
                    shadow-sm
                ">
                    {discount}% OFF
                </div>
            )}
        </div>
    )
})

/* ─── Home Page ─── */
export default function Home() {
    const navigate = useNavigate()
    const { items, addToCart, incrementQty, decrementQty, isInCart, getQty, totalItems, totalAmount } = useCart()

    const [selectedCategory, setSelectedCategory] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [scrolled, setScrolled] = useState(false)
    const scrolledRef = useRef(false)
    const [shopOpen, setShopOpen] = useState(true)
    const [products, setProducts] = useState(PRODUCTS)
    const [showAppPrompt, setShowAppPrompt] = useState(false)

    // Dismiss app banner on web
    useEffect(() => {
        if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'web') {
            const dismissed = localStorage.getItem('hideAppBanner')
            if (!dismissed) {
                const t = setTimeout(() => setShowAppPrompt(true), 1500)
                return () => clearTimeout(t)
            }
        }
    }, [])

    const dismissAppBanner = () => {
        localStorage.setItem('hideAppBanner', 'true')
        setShowAppPrompt(false)
    }
    const [showAddressModal, setShowAddressModal] = useState(false)
    const [savedAddresses, setSavedAddresses] = useState([])
    const [customerPhone, setCustomerPhone] = useState('')

    // Read strictly active delivery address from local storage
    const [activeAddress, setActiveAddress] = useState(() => {
        try {
            const data = localStorage.getItem('mrn_customer_data')
            if (data) {
                const parsed = JSON.parse(data)
                // If they have an active address object, use its label. Otherwise try area. 
                if (parsed.activeAddress && parsed.activeAddress.area) return `${parsed.activeAddress.houseNo ? parsed.activeAddress.houseNo + ', ' : ''}${parsed.activeAddress.area}`
                if (parsed.area) return `${parsed.house_no ? parsed.house_no + ', ' : ''}${parsed.area}`
            }
        } catch { }
        return 'Select Delivery Address'
    })

    // Load customer data for the address modal
    useEffect(() => {
        try {
            const data = localStorage.getItem('mrn_customer_data')
            if (data) {
                const parsed = JSON.parse(data)
                if (parsed.phone) {
                    setCustomerPhone(parsed.phone)
                    fetchAddressesForPhone(parsed.phone)
                }
            }
        } catch { }
    }, [])

    const fetchAddressesForPhone = async (phone) => {
        const { data, error } = await supabase
            .from('customers')
            .select('addresses')
            .eq('phone', phone)
            .single()

        if (data && data.addresses && data.addresses.length > 0) {
            setSavedAddresses(data.addresses)
        }
    }

    const handleSelectAddress = (addr) => {
        try {
            const data = localStorage.getItem('mrn_customer_data')
            const parsed = data ? JSON.parse(data) : {}
            parsed.activeAddress = addr
            // Keep backwards compatibility for Checkout.jsx
            parsed.house_no = addr.houseNo
            parsed.area = addr.area
            if (addr.location) parsed.location = addr.location
            localStorage.setItem('mrn_customer_data', JSON.stringify(parsed))

            setActiveAddress(`${addr.houseNo ? addr.houseNo + ', ' : ''}${addr.area}`)
            setShowAddressModal(false)
            toast.success('Delivery address updated')
        } catch { }
    }
    useEffect(() => {
        const isWeb = Capacitor.getPlatform() === 'web'
        const hasDismissed = localStorage.getItem('hideAppPrompt') === 'true'

        if (isWeb) {
            // Attempt Android intent deep link redirect first
            const isAndroid = /android/i.test(navigator.userAgent)
            if (isAndroid && !sessionStorage.getItem('redirectAttempted')) {
                sessionStorage.setItem('redirectAttempted', 'true')
                // Try to open the app via intent.
                // If it fails, the browser ignores it and we proceed to show the prompt.
                // We intentionally omit `package=` so Android won't crash-redirect to the Google Play Store!
                window.location.href = "intent://#Intent;scheme=mrnmulla;S.browser_fallback_url=;end"
            }

            // Show prompt if not dismissed
            if (!hasDismissed) {
                const timer = setTimeout(() => setShowAppPrompt(true), 1500)
                return () => clearTimeout(timer)
            }
        }
    }, [])

    const handleDismissPrompt = () => {
        localStorage.setItem('hideAppPrompt', 'true')
    }

    // Read shop status
    // Shop status & Product fetching
    useEffect(() => {
        // 1. Fetch Shop Status from Supabase
        const fetchShopStatus = async () => {
            const { data } = await supabase
                .from('store_settings')
                .select('value')
                .eq('key', 'shop_open')
                .single()

            if (data) {
                setShopOpen(data.value === 'true')
            }
        }

        // 2. Subscribe to Shop Status changes
        let statusSubscription = null
        const setupStoreSubscription = () => {
            fetchShopStatus()
            if (statusSubscription) supabase.removeChannel(statusSubscription)

            statusSubscription = supabase
                .channel('home_shop_status')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'store_settings'
                }, (payload) => {
                    console.log('🔔 STORE SETTINGS UPDATE:', payload)
                    if (payload.new && payload.new.key === 'shop_open') {
                        setShopOpen(payload.new.value === 'true')
                    }
                })
                .subscribe((status) => console.log('🔌 Store Status Subscription:', status))
        }

        setupStoreSubscription()
        window.addEventListener('appResumed', setupStoreSubscription)

        return () => {
            if (statusSubscription) supabase.removeChannel(statusSubscription)
            window.removeEventListener('appResumed', setupStoreSubscription)
        }
    }, [])

    // Fetch products from Supabase
    useEffect(() => {
        const fetchProducts = async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('id', { ascending: true })

            if (data && !error) {
                setProducts(data)
            }
        }

        let subscription = null

        const setupProductsSubscription = () => {
            fetchProducts()
            if (subscription) supabase.removeChannel(subscription)

            subscription = supabase
                .channel('public:products')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                    console.log('📦 PRODUCT UPDATE:', payload)
                    if (payload.eventType === 'INSERT') {
                        setProducts(prev => [...prev, payload.new])
                    } else if (payload.eventType === 'UPDATE') {
                        setProducts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
                    } else if (payload.eventType === 'DELETE') {
                        setProducts(prev => prev.filter(p => p.id !== payload.old.id))
                    }
                })
                .subscribe((status) => console.log('🔌 Product Subscription:', status))
        }

        setupProductsSubscription()
        window.addEventListener('appResumed', setupProductsSubscription)

        return () => {
            if (subscription) supabase.removeChannel(subscription)
            window.removeEventListener('appResumed', setupProductsSubscription)
        }
    }, [])

    // Single optimised scroll listener — uses ref to avoid double re-render
    useEffect(() => {
        const handleScroll = () => {
            const isNowScrolled = window.scrollY > 60
            if (isNowScrolled !== scrolledRef.current) {
                scrolledRef.current = isNowScrolled
                setScrolled(isNowScrolled)
            }
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Categories with counts
    const categoriesWithCounts = useMemo(() => {
        const counts = {}
        products.forEach(p => {
            counts[p.category] = (counts[p.category] || 0) + 1
        })
        return CATEGORIES.map(c =>
            c.name === 'All'
                ? { ...c, count: products.length }
                : { ...c, count: counts[c.name] || 0 }
        )
    }, [products])

    // Filtered products
    const filteredProducts = useMemo(() => {
        let result = products
        if (selectedCategory !== 'All') {
            result = result.filter(p => p.category === selectedCategory)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().replace(/\s+/g, '')
            result = result.filter(p =>
                p.name.toLowerCase().replace(/\s+/g, '').includes(q) ||
                p.category.toLowerCase().replace(/\s+/g, '').includes(q)
            )
        }
        return result
    }, [products, selectedCategory, searchQuery])

    const openProductModal = useCallback((product) => {
        setSelectedProduct(product)
    }, [])

    // Global toast dedup: dismiss any active toast before showing a new one
    const activeToastId = useRef(null)
    const showToast = useCallback((type, message, options = {}) => {
        if (activeToastId.current) toast.dismiss(activeToastId.current)
        activeToastId.current = toast[type](message, options)
        return activeToastId.current
    }, [])

    const handleAddToCart = useCallback((product) => {
        if (!shopOpen) {
            showToast('error', '🔴 Shop is currently CLOSED')
            return
        }
        addToCart(product)
    }, [shopOpen, addToCart, showToast])

    return (
        <div className="min-h-screen bg-gray-50 pb-32">

            {/* ─── WEB-ONLY APK DOWNLOAD BANNER (fixed top) ─── */}
            {Capacitor.getPlatform() === 'web' && showAppPrompt && (
                <div
                    style={{ zIndex: 9999 }}
                    className="fixed top-0 left-0 right-0 bg-[#E0A75E] text-[#023430] px-4 py-2 flex items-center justify-between shadow-md gap-2"
                >
                    <div className="flex items-center gap-2 shrink-0">
                        <Download size={16} className="animate-bounce" />
                        <span className="text-xs font-black uppercase tracking-wider">Get the App!</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href="https://github.com/mdaziz-07/MRN-Mulla-Kirana-APK/releases/latest/download/MRN.Mulla.Kirana.apk"
                            className="bg-[#023430] text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm active:scale-95 transition-transform"
                        >
                            Download
                        </a>
                        <button
                            type="button"
                            onClick={() => dismissAppBanner()}
                            className="text-[10px] font-bold underline opacity-70 whitespace-nowrap px-1 py-1"
                        >
                            Continue on Web
                        </button>
                        <button
                            type="button"
                            onClick={() => dismissAppBanner()}
                            className="w-6 h-6 flex items-center justify-center bg-[#023430]/15 rounded-full font-bold text-sm leading-none"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* ─── HEADER ─── */}
            <div className="bg-[#023430] text-white pt-[calc(env(safe-area-inset-top)+1.2rem)] pb-3 px-5 relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h1 className="text-xl font-black tracking-wide uppercase">
                            {STORE_NAME}
                        </h1>
                        <div
                            className="flex items-center gap-2 mt-2 opacity-90 cursor-pointer hover:opacity-100 transition-opacity bg-white/10 px-3 py-1.5 rounded-full w-max"
                            onClick={() => setShowAddressModal(true)}
                        >
                            <MapPin size={14} className="text-[#E0A75E]" />
                            <p className="text-xs font-semibold truncate max-w-[200px]">{activeAddress}</p>
                            <ChevronRight size={14} />
                        </div>
                        <div className="flex gap-2 mt-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border backdrop-blur-sm ${shopOpen ? 'bg-green-400/20 text-green-100 border-green-400/30' : 'bg-red-400/20 text-red-100 border-red-400/30'}`}>
                                {shopOpen ? 'OPEN NOW' : 'CLOSED'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/print')}
                            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors"
                            aria-label="Print"
                        >
                            <Printer size={20} />
                        </button>
                        <button
                            onClick={() => navigate('/orders')}
                            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors"
                            aria-label="My Orders"
                        >
                            <ClipboardList size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── SEARCH BAR — sticky with safe-area header protector ─── */}
            <div className={`sticky top-0 z-50 px-4 pb-3 transition-all duration-300 bg-[#023430] rounded-b-2xl ${scrolled ? 'pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-lg' : 'pt-2 shadow-md'}`}>
                <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search For Atta, Dal, Milk..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white text-gray-800 rounded-full pl-10 pr-9 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E0A75E] shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            <X size={15} className="text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── CATEGORY PILLS ─── */}
            <div className="
                flex overflow-x-auto px-5 py-6 gap-5
                scrollbar-hide mb-2 snap-x
            ">
                {categoriesWithCounts.map((cat) => (
                    <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className="flex flex-col items-center min-w-[76px] cursor-pointer group snap-start"
                    >
                        <div className={`
                            w-16 h-16 md:w-24 md:h-24
                            rounded-full flex items-center justify-center
                            mb-2.5 transition-all duration-300 overflow-hidden
                            ${selectedCategory === cat.name
                                ? 'bg-green-50 border-2 border-green-600 shadow-md scale-105'
                                : 'bg-white border border-gray-100 shadow-sm group-hover:shadow-md'
                            }
                        `}>
                            {cat.image ? (
                                <img src={cat.image} alt={cat.name} className="w-full h-full object-contain p-2 mix-blend-multiply" />
                            ) : (
                                <span className="text-2xl md:text-3xl">{cat.icon}</span>
                            )}
                        </div>
                        <span className={`
                            text-[11px] font-bold text-center leading-tight max-w-[80px]
                            ${selectedCategory === cat.name ? 'text-green-800' : 'text-gray-500'}
                        `}>
                            {cat.name}
                        </span>
                    </button>
                ))}
            </div>

            {/* ─── PRODUCT GRID ─── */}
            <main className="px-3 pb-6">
                {/* Section Title — always show count */}
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-lg font-bold text-[#1A1A1A]">
                        {selectedCategory === 'All' ? 'All Products' : selectedCategory}
                    </h2>
                    <span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        {filteredProducts.length} items
                    </span>
                </div>

                {searchQuery && (
                    <div className="mb-3 px-1">
                        <p className="text-sm text-[#757575]">
                            Showing results for &ldquo;<span className="font-semibold text-[#1A1A1A]">{searchQuery}</span>&rdquo;
                            <span className="ml-2 text-[#BDBDBD]">({filteredProducts.length})</span>
                        </p>
                    </div>
                )}

                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                        {filteredProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                isInCart={isInCart(product.id)}
                                qty={getQty(product.id)}
                                onAdd={handleAddToCart}
                                onIncrement={incrementQty}
                                onDecrement={decrementQty}
                                onOpenModal={openProductModal}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🔍</div>
                        <p className="text-lg font-semibold text-[#1A1A1A] mb-1">No products found</p>
                        <p className="text-sm text-[#757575]">Try a different search or category</p>
                    </div>
                )}
            </main>

            {/* ─── WHATSAPP BUTTON ─── */}
            {!selectedProduct && (
                <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 items-end">
                    {/* WhatsApp Button */}
                    <a
                        href={`https://wa.me/91${STORE_PHONE}?text=Hello! I need help with...`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#25D366] text-white p-3.5 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center hover:shadow-green-500/30"
                    >
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                    </a>
                </div>
            )}

            {/* ─── FLOATING CART BUTTON ─── */}
            {totalItems > 0 && !selectedProduct && (
                <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 -translate-x-1/2 z-40 w-auto">
                    <div
                        onClick={() => navigate('/checkout')}
                        className="
                            bg-black/90 backdrop-blur-md text-white
                            px-4 py-2.5 rounded-full
                            shadow-2xl
                            flex items-center justify-center gap-3
                            cursor-pointer
                            hover:scale-105 transition-all active:scale-95
                            border border-white/10
                            animate-slideUp
                        "
                    >
                        <div className="bg-white/20 p-1.5 rounded-full">
                            <ShoppingCart size={18} className="text-green-300" />
                        </div>
                        <span className="font-bold text-sm tracking-wide">
                            {totalItems} Items | ₹{totalAmount}
                        </span>
                        <ChevronRight size={16} className="text-gray-400" />
                    </div>
                </div>
            )}

            {/* ─── PRODUCT DETAIL MODAL ─── */}
            {selectedProduct && (
                <ProductModal
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    isInCart={isInCart(selectedProduct.id)}
                    qty={getQty(selectedProduct.id)}
                    onAdd={handleAddToCart}
                    onIncrement={incrementQty}
                    onDecrement={decrementQty}
                />
            )}

            {/* ─── APP DOWNLOAD PROMPT (Web Only) ─── */}
            {showAppPrompt && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleIn relative">
                        {/* Close button top right */}
                        <button
                            onClick={handleDismissPrompt}
                            className="absolute top-4 right-4 bg-gray-100 p-1.5 rounded-full text-gray-500 hover:bg-gray-200 transition-colors z-10"
                        >
                            <X size={18} />
                        </button>

                        {/* Header Image Area */}
                        <div className="bg-[#023430] py-8 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-3 relative z-10">
                                <span className="text-2xl font-black text-[#023430]">M</span>
                            </div>
                            <h3 className="text-white font-bold text-lg relative z-10">MRN Mulla Kirana</h3>
                        </div>

                        {/* Content */}
                        <div className="p-6 text-center space-y-4">
                            <h4 className="font-extrabold text-[#1A1A1A] text-xl">
                                For the Best Experience!
                            </h4>
                            <p className="text-sm text-[#757575] leading-relaxed">
                                Get our Free Android App for faster ordering, real-time tracking, and exclusive offers.
                            </p>

                            <div className="pt-2 space-y-3">
                                <a
                                    onClick={async (e) => {
                                        e.preventDefault()
                                        handleDismissPrompt()
                                        const url = "https://github.com/mdaziz-07/MRN-Mulla-Kirana-APK/releases/latest/download/MRN.Mulla.Kirana.apk"
                                        if (Capacitor.isNativePlatform()) {
                                            const { Browser } = await import('@capacitor/browser')
                                            await Browser.open({ url })
                                        } else {
                                            window.open(url, '_blank')
                                        }
                                    }}
                                    href="#"
                                    className="w-full flex items-center justify-center gap-2 bg-[#023430] text-white py-3.5 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg hover:shadow-[#023430]/30"
                                >
                                    <Download size={20} />
                                    Download App
                                </a>
                                <button
                                    onClick={handleDismissPrompt}
                                    className="w-full py-3 rounded-xl font-bold text-[#757575] hover:bg-gray-50 transition-colors"
                                >
                                    Continue on Mobile Web
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── ADDRESS SELECTOR MODAL ─── */}
            {showAddressModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fadeIn">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-slideUp">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                <MapPin size={18} className="text-[#023430]" /> Select Delivery Address
                            </h3>
                            <button onClick={() => setShowAddressModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 max-h-[60vh] overflow-y-auto bg-white">
                            {!customerPhone ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <LogIn size={28} />
                                    </div>
                                    <h4 className="font-bold text-gray-900 mb-2">Please Login</h4>
                                    <p className="text-sm text-gray-500 mb-6 px-4">You need to enter your phone number during your first checkout to save addresses.</p>
                                    <button
                                        onClick={() => {
                                            setShowAddressModal(false)
                                            navigate('/checkout')
                                        }}
                                        className="bg-[#023430] text-white px-6 py-2.5 rounded-xl font-bold text-sm"
                                    >
                                        Go to Checkout
                                    </button>
                                </div>
                            ) : savedAddresses.length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-sm font-semibold text-gray-600 mb-2">Your Saved Addresses</p>
                                    {savedAddresses.map((addr, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => handleSelectAddress(addr)}
                                            className="p-4 border-2 border-gray-100 rounded-2xl cursor-pointer hover:border-[#023430] hover:bg-green-50/50 transition-all flex items-start gap-3"
                                        >
                                            <div className="mt-1 bg-gray-100 p-2 rounded-full text-gray-500">
                                                <Map size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{addr.houseNo ? `${addr.houseNo}, ` : ''}{addr.area}</p>
                                                {addr.location && <p className="text-xs text-gray-500 mt-1">📍 Location Saved</p>}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                                        <button
                                            onClick={() => {
                                                setShowAddressModal(false)
                                                navigate('/checkout')
                                            }}
                                            className="text-sm font-bold text-[#023430] flex items-center justify-center gap-1 w-full p-2"
                                        >
                                            <Plus size={16} /> Add new address during checkout
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <MapPin size={32} className="text-gray-300 mx-auto mb-3" />
                                    <p className="font-semibold text-gray-800">No saved addresses</p>
                                    <p className="text-sm text-gray-500 mb-4">Checkout once to automatically save your address.</p>
                                    <button
                                        onClick={() => {
                                            setShowAddressModal(false)
                                            navigate('/checkout')
                                        }}
                                        className="bg-[#023430] text-white px-6 py-2.5 rounded-xl font-bold text-sm"
                                    >
                                        Go to Checkout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
