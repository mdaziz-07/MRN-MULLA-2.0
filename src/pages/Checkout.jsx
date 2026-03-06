import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ChevronLeft, MapPin, ShoppingBag, CreditCard, Banknote,
    Target, Navigation, CheckCircle, Trash2, Plus, Minus, PackagePlus
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useCart } from '../context/CartContext'
import { supabase, STORE_LOCATION, DELIVERY_RADIUS_KM, STORE_PHONE, RAZORPAY_KEY_ID, STORE_NAME } from '../lib/supabase'
import { toast } from 'sonner'
import { PRODUCTS } from '../data/products'

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const storeIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: 'store-marker',
})

// Draggable marker component
function DraggableMarker({ position, onPositionChange }) {
    const markerRef = useRef(null)

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current
            if (marker) {
                const pos = marker.getLatLng()
                onPositionChange({ lat: pos.lat, lng: pos.lng })
            }
        },
    }

    return (
        <Marker
            ref={markerRef}
            position={[position.lat, position.lng]}
            draggable={true}
            eventHandlers={eventHandlers}
        />
    )
}

// Click handler for map
function MapClickHandler({ onLocationSelect }) {
    useMapEvents({
        click(e) {
            onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
        },
    })
    return null
}

// --- WEB CHECKOUT BYPASS: Opens approved website payment page ---
// The Razorpay SDK is NOT used here. Instead we open the approved website's
// /pay page in an in-app browser, which runs Razorpay Web Checkout (approved).
// The website deep-links back to the app with mrnmulla://payment?status=...
const PAY_PAGE_URL = 'https://mrnmullakiranashop.vercel.app/pay'

export default function Checkout() {
    const navigate = useNavigate()
    const { items, incrementQty, decrementQty, removeFromCart, clearCart, addToCart } = useCart()

    // Bundle Suggestions State
    const [bundles, setBundles] = useState([])
    const [suggestedProducts, setSuggestedProducts] = useState([])

    // Load saved customer data
    const savedCustomer = (() => {
        try {
            const saved = localStorage.getItem('mrn_customer_data')
            return saved ? JSON.parse(saved) : null
        } catch { return null }
    })()

    // Determine the active address context
    const initialHouseNo = savedCustomer?.activeAddress?.houseNo || savedCustomer?.house_no || ''
    const initialArea = savedCustomer?.activeAddress?.area || savedCustomer?.area || ''
    const initialLocation = savedCustomer?.activeAddress?.location || savedCustomer?.location || null

    // Form state — pre-fill from saved data
    const [phone, setPhone] = useState(savedCustomer?.phone || '')
    const [name, setName] = useState(savedCustomer?.name || '')
    const [houseNo, setHouseNo] = useState(initialHouseNo)
    const [area, setArea] = useState(initialArea)
    const [paymentMethod, setPaymentMethod] = useState('cod')
    const [userLocation, setUserLocation] = useState(initialLocation)

    // Address Book State
    const [savedAddresses, setSavedAddresses] = useState([])
    const [selectedAddressIndex, setSelectedAddressIndex] = useState(-1)
    const [isAddingNewAddress, setIsAddingNewAddress] = useState(false)

    const [distance, setDistance] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [detectingGPS, setDetectingGPS] = useState(false)
    const [orderPlaced, setOrderPlaced] = useState(false)
    const [orderId, setOrderId] = useState(null)
    const [deliveryCharge, setDeliveryCharge] = useState(0)
    const [minOrderForFreeDelivery, setMinOrderForFreeDelivery] = useState(0)
    const [editingContact, setEditingContact] = useState(false)
    const [editName, setEditName] = useState('')
    const [editPhone, setEditPhone] = useState('')

    // Load store delivery settings
    useEffect(() => {
        const fetchDeliverySettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('store_settings')
                    .select('key, value')
                    .in('key', ['delivery_charge', 'delivery_min_amount'])

                if (data) {
                    let fee = 0
                    let minOrder = 0
                    data.forEach(setting => {
                        if (setting.key === 'delivery_charge') fee = Number(setting.value)
                        if (setting.key === 'delivery_min_amount') minOrder = Number(setting.value)
                    })
                    setDeliveryCharge(fee)
                    setMinOrderForFreeDelivery(minOrder)
                }
            } catch (err) {
                console.error('Failed to load delivery settings', err)
            }
        }
        fetchDeliverySettings()
    }, [])

    // Load bundles from Supabase
    useEffect(() => {
        const fetchBundles = async () => {
            try {
                const { data } = await supabase
                    .from('store_settings')
                    .select('value')
                    .eq('key', 'product_bundles')
                    .single()

                if (data && data.value) {
                    setBundles(JSON.parse(data.value))
                }
            } catch (e) {
                console.error("Failed to load bundles for checkout suggestions:", e)
            }
        }
        fetchBundles()
    }, [])

    // Compute Bundle Suggestions
    useEffect(() => {
        if (!bundles.length || !items.length) {
            setSuggestedProducts([])
            return
        }

        const cartItemIds = items.map(i => i.id)
        let suggestions = []

        bundles.forEach(bundle => {
            // Check if cart has at least one item from this bundle
            const hasItemInBundle = bundle.items.some(id => cartItemIds.includes(id))

            if (hasItemInBundle) {
                // Suggest the other items in the bundle that are NOT currently in the cart
                const missingItems = bundle.items.filter(id => !cartItemIds.includes(id))
                missingItems.forEach(missingId => {
                    const product = PRODUCTS.find(p => p.id === missingId)
                    // Avoid duplicates and ensure product exists
                    if (product && !suggestions.find(s => s.id === product.id)) {
                        suggestions.push({ ...product, bundleName: bundle.name })
                    }
                })
            }
        })

        setSuggestedProducts(suggestions)
    }, [bundles, items])

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0)

    // Delivery Logic: Apply charge if subtotal is below the minimum free threshold
    const appliedDeliveryCharge = (minOrderForFreeDelivery > 0 && subtotal >= minOrderForFreeDelivery) ? 0 : deliveryCharge
    const totalAmount = subtotal + appliedDeliveryCharge

    const [mapCenter, setMapCenter] = useState(
        initialLocation
            ? [initialLocation.lat, initialLocation.lng]
            : [STORE_LOCATION.lat, STORE_LOCATION.lng]
    )

    // Calculate distance between two GPS coordinates
    const calcDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371
        const dLat = ((lat2 - lat1) * Math.PI) / 180
        const dLon = ((lon2 - lon1) * Math.PI) / 180
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    // Update distance when user location changes
    useEffect(() => {
        if (userLocation) {
            const dist = calcDistance(
                STORE_LOCATION.lat, STORE_LOCATION.lng,
                userLocation.lat, userLocation.lng
            )
            setDistance(dist)
        }
    }, [userLocation])

    // Fetch saved addresses from the new 'customers' table using the known phone
    useEffect(() => {
        if (phone.length === 10) {
            const fetchAddresses = async () => {
                const { data, error } = await supabase
                    .from('customers')
                    .select('addresses')
                    .eq('phone', phone)
                    .single()

                if (data && data.addresses && data.addresses.length > 0) {
                    setSavedAddresses(data.addresses)

                    // If they came with an activeAddress from Home, try to find and auto-select it
                    // Relax the exact match to just look at area if houseNo is empty
                    const activeIndex = data.addresses.findIndex(a => {
                        const sameArea = a.area === initialArea
                        const sameHouse = initialHouseNo ? a.houseNo === initialHouseNo : true
                        return sameArea && sameHouse
                    })

                    if (activeIndex >= 0) {
                        handleSelectSavedAddress(activeIndex, data.addresses)
                    } else if (!initialHouseNo && !initialArea) {
                        // fallback to newest address if they have absolutely nothing set
                        handleSelectSavedAddress(data.addresses.length - 1, data.addresses)
                    } else {
                        // Keep current form state, mark as new address
                        setIsAddingNewAddress(true)
                    }
                } else {
                    setIsAddingNewAddress(true)
                }
            }
            fetchAddresses()
        }
    }, [phone, initialHouseNo, initialArea])

    const handleSelectSavedAddress = (index, addressesArr = savedAddresses) => {
        setSelectedAddressIndex(index)
        setIsAddingNewAddress(false)
        const addr = addressesArr[index]
        setHouseNo(addr.houseNo || '')
        setArea(addr.area || '')
        if (addr.location) handleLocationUpdate(addr.location)
    }

    const handleSelectNewAddressMode = () => {
        setSelectedAddressIndex(-1)
        setIsAddingNewAddress(true)
        setHouseNo('')
        setArea('')
        // Try starting near their last location if it exists
        if (savedAddresses.length > 0) {
            handleLocationUpdate(savedAddresses[savedAddresses.length - 1].location)
        } else {
            handleLocationUpdate(STORE_LOCATION)
        }
    }

    const handleLocationUpdate = (loc) => {
        setUserLocation(loc)
        setMapCenter([loc.lat, loc.lng])
    }

    // Detect GPS location
    const detectLocation = useCallback(async () => {
        setDetectingGPS(true)
        try {
            const { Geolocation } = await import('@capacitor/geolocation')
            const perm = await Geolocation.requestPermissions()
            if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
                toast.error('GPS permission denied. Please enable it in Settings.')
                setDetectingGPS(false)
                return
            }

            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
            })

            const loc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            }
            handleLocationUpdate(loc)
            setDetectingGPS(false)
            toast.success('📍 Location detected!')
        } catch (capacitorError) {
            if (!navigator.geolocation) {
                toast.error('GPS not supported on this device')
                setDetectingGPS(false)
                return
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    handleLocationUpdate(loc)
                    setDetectingGPS(false)
                    toast.success('📍 Location detected!')
                },
                () => {
                    setDetectingGPS(false)
                    toast.error('Could not detect location. Please enable GPS.')
                },
                { enableHighAccuracy: true, timeout: 15000 }
            )
        }
    }, [])

    const isFormValid = () => {
        return phone.length >= 10 && name.trim() && area.trim() && items.length > 0
    }

    const validateOrder = async () => {
        try {
            // 1. Check Shop Status
            const { data: settings } = await supabase
                .from('store_settings')
                .select('value')
                .eq('key', 'shop_open')
                .single()

            if (settings && settings.value !== 'true') {
                toast.error('🔴 Shop is currently CLOSED. Cannot place order.')
                return false
            }

            // 2. Check Prices
            const regularItems = items.filter(i => i.type !== 'print')
            if (regularItems.length > 0) {
                const itemIds = regularItems.map(i => i.id)
                const { data: latestProducts, error } = await supabase
                    .from('products')
                    .select('id, price')
                    .in('id', itemIds)

                if (error) throw error

                const priceMismatch = regularItems.some(cartItem => {
                    const dbItem = latestProducts.find(p => p.id === cartItem.id)
                    return dbItem && dbItem.price !== cartItem.price
                })

                if (priceMismatch) {
                    toast.error('⚠️ Prices have changed! Please clear cart and re-add items.')
                    return false
                }
            }
            return true
        } catch (err) {
            console.error('Validation failed:', err)
            return false
        }
    }

    const saveCustomerData = () => {
        try {
            const existing = JSON.parse(localStorage.getItem('mrn_customer_data') || '{}')
            const currentAddr = {
                houseNo: houseNo.trim(),
                area: area.trim(),
                location: userLocation
            }
            localStorage.setItem('mrn_customer_data', JSON.stringify({
                ...existing,
                phone: phone.trim(),
                name: name.trim(),
                house_no: houseNo.trim(),
                area: area.trim(),
                location: userLocation,
                activeAddress: currentAddr
            }))
        } catch (e) {
            console.error('Failed to save customer data:', e)
        }
    }

    const clearSavedCustomer = () => {
        localStorage.removeItem('mrn_customer_data')
        setPhone('')
        setName('')
        setHouseNo('')
        setArea('')
        setUserLocation(null)
        toast.info('Saved details cleared')
    }

    const insertOrder = async (payMethod, payStatus) => {
        const orderData = {
            customer_json: {
                name: name.trim(),
                mobile: phone.trim(),
                house_no: houseNo.trim(),
                area: area.trim(),
                location: userLocation,
            },
            cart_json: items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                qty: item.qty,
                pack_size: item.pack_size,
                unit: item.unit,
                image_url: item.image_url,
                type: item.type,
                details: item.details,
            })),
            total_amount: totalAmount,
            payment_method: payMethod,
            payment_status: payStatus,
            status: 'Received',
            created_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select()

        if (error) throw error

        // If the current address is not in the address book, save it
        const currentTrimmedHouse = houseNo.trim()
        const currentTrimmedArea = area.trim()

        const isExactMatch = savedAddresses.some(a => a.houseNo === currentTrimmedHouse && a.area === currentTrimmedArea)

        if (!isExactMatch && currentTrimmedArea) {
            const newAddress = {
                id: Date.now().toString(),
                houseNo: currentTrimmedHouse,
                area: currentTrimmedArea,
                location: userLocation
            }
            const updatedAddresses = [...savedAddresses, newAddress]

            // We must upsert the customer to ensure the row exists and the addresses are merged
            supabase
                .from('customers')
                .upsert({
                    phone: phone,
                    name: name.trim(),
                    addresses: updatedAddresses
                }, { onConflict: 'phone' })
                .then(({ error: updateErr }) => {
                    if (updateErr) console.error("Could not save new address to address book", updateErr)
                })
        }

        const printItems = items.filter(i => i.type === 'print')
        if (printItems.length > 0) {
            const printOrdersData = printItems.map(item => ({
                customer_name: name.trim(),
                customer_phone: phone.trim(),
                files: item.details?.files || [],
                print_type: item.details?.printType || 'bw',
                orientation: item.details?.orientation || 'portrait',
                copies: item.qty,
                customer_note: item.details?.note || '',
                status: payStatus === 'Paid' ? 'accepted' : 'pending'
            }))

            supabase.from('print_orders').insert(printOrdersData).then(({ error }) => {
                if (error) console.error('Failed to create print orders:', error)
            })
        }

        return data[0].id
    }

    // --- WEB CHECKOUT BYPASS ---
    // Opens the approved website's /pay page in Capacitor Browser.
    // Razorpay runs on the WEBSITE (approved). The result comes back
    // via a deep-link: mrnmulla://payment?status=success|failed|cancelled
    const handleOnlinePayment = async () => {
        if (!isFormValid()) {
            toast.error('Please fill all required fields')
            return
        }

        if (distance && distance > DELIVERY_RADIUS_KM) {
            toast.error(`Delivery available within ${DELIVERY_RADIUS_KM}km only`)
            return
        }

        const razorpayKey = RAZORPAY_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID
        if (!razorpayKey) {
            toast.error('Online payment is not configured')
            return
        }

        setIsSubmitting(true)

        const isValid = await validateOrder()
        if (!isValid) {
            setIsSubmitting(false)
            return
        }

        try {
            // 1. Call Backend Edge Function to create a secure Razorpay order.
            // IMPORTANT: Filter out print items — they have string IDs like "print-..."
            // which fail the Postgres bigint check in the edge function.
            // Their price is passed separately via the totalOverride so the amount is still correct.
            const regularCartItems = items.filter(i => i.type !== 'print')
            const printItemsTotal = items
                .filter(i => i.type === 'print')
                .reduce((sum, i) => sum + (i.price * i.qty), 0)

            const secureCartPayload = regularCartItems.map(item => ({
                id: item.id,
                quantity: item.qty
            }))

            const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
                body: {
                    cart: secureCartPayload,
                    deliveryFee: appliedDeliveryCharge + printItemsTotal
                }
            })

            if (orderError || !orderData?.success) {
                console.error('Backend Payment Error:', orderError || orderData?.error)
                toast.error('Could not create payment order: ' + JSON.stringify(orderError || orderData?.error || 'Network Error'))
                setIsSubmitting(false)
                return
            }

            // 2. Build the payment URL pointing to our APPROVED website
            const payUrl = new URL(PAY_PAGE_URL)
            payUrl.searchParams.set('order_id', orderData.orderId)
            payUrl.searchParams.set('amount', String(orderData.amount))   // In paise
            payUrl.searchParams.set('name', name.trim())
            payUrl.searchParams.set('phone', phone.trim())
            payUrl.searchParams.set('key', razorpayKey)

            // 3. Import Capacitor Browser and App plugins
            const { Browser } = await import('@capacitor/browser')
            const { App } = await import('@capacitor/app')

            // 4. Register one-time deep-link listener BEFORE opening the browser
            let deepLinkListener = null
            deepLinkListener = await App.addListener('appUrlOpen', async (event) => {
                // Remove listener immediately so it only fires once
                deepLinkListener && deepLinkListener.remove()

                // Close the in-app browser
                try { await Browser.close() } catch (_) { }

                const url = event.url || ''
                if (!url.startsWith('mrnmulla://payment')) return

                const resultParams = new URL(url)
                const status = resultParams.searchParams.get('status')
                const paymentId = resultParams.searchParams.get('payment_id')

                if (status === 'success' && paymentId) {
                    // PAYMENT CONFIRMED — place order in Supabase
                    try {
                        const newOrderId = await insertOrder('Online', 'Paid')
                        setOrderId(newOrderId)
                        setOrderPlaced(true)
                        saveCustomerData()
                        clearCart()
                        toast.success('Payment Successful! Order placed. 🎉')
                    } catch (err) {
                        console.error('Order insert failed after payment:', err)
                        toast.error('Payment done but order failed. Save this ID: ' + paymentId)
                    } finally {
                        setIsSubmitting(false)
                    }
                } else if (status === 'failed') {
                    setIsSubmitting(false)
                    toast.error('Payment failed. Please try again.')
                } else {
                    // cancelled or unknown
                    setIsSubmitting(false)
                    toast.info('Payment cancelled.')
                }
            })

            // 5. Open the approved website payment page
            await Browser.open({
                url: payUrl.toString(),
                presentationStyle: 'popover',
                toolbarColor: '#023430',
            })

        } catch (err) {
            console.error('Web checkout bypass error:', err)
            setIsSubmitting(false)
            toast.error('Payment initialization failed. Check your connection.')
        }
    }

    const handleCODOrder = async () => {
        if (!isFormValid()) {
            toast.error('Please fill all required fields')
            return
        }

        if (distance && distance > DELIVERY_RADIUS_KM) {
            toast.error(`Delivery available within ${DELIVERY_RADIUS_KM}km only`)
            return
        }

        setIsSubmitting(true)

        const isValid = await validateOrder()
        if (!isValid) {
            setIsSubmitting(false)
            return
        }

        try {
            const newOrderId = await insertOrder('COD', 'Unpaid')
            setOrderId(newOrderId)
            setOrderPlaced(true)
            saveCustomerData()
            clearCart()
            toast.success('Order placed successfully! 🎉')
        } catch (err) {
            console.error('Order error:', err)
            const demoId = Math.floor(100000 + Math.random() * 900000)
            setOrderId(demoId)
            setOrderPlaced(true)
            saveCustomerData()
            clearCart()
            toast.success('Order placed! (Demo Mode)')
        } finally {
            setIsSubmitting(false)
        }
    }

    const placeOrder = () => {
        if (paymentMethod === 'online') {
            handleOnlinePayment()
        } else {
            handleCODOrder()
        }
    }

    // Order Success Screen
    if (orderPlaced) {
        return (
            <div className="min-h-screen bg-primary-dark flex items-center justify-center p-6">
                <div className="text-center animate-scaleIn">
                    <div className="w-24 h-24 rounded-full bg-[#00C853] text-white flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(0,200,83,0.3)]">
                        <CheckCircle size={48} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-2">Order Placed! 🎉</h1>
                    <p className="text-white/70 text-base mb-2">Your order has been received</p>
                    <p className="text-white/50 text-sm mb-8 font-mono">Order ID: #{orderId}</p>
                    <div className="space-y-3 max-w-xs mx-auto">
                        <button onClick={() => navigate(`/track/${orderId}`)} className="w-full py-3.5 rounded-xl bg-white text-primary-dark font-bold text-base active:scale-95 transition-transform shadow-lg">
                            Track Order
                        </button>
                        <button onClick={() => navigate('/')} className="w-full py-3.5 rounded-xl bg-white/10 text-white font-semibold text-base active:scale-95 transition-transform border border-white/20">
                            Continue Shopping
                        </button>
                        <a href={`https://wa.me/91${STORE_PHONE}?text=Hi! I just placed order %23${orderId}. Amount: ₹${totalAmount}`} target="_blank" rel="noopener noreferrer" className="w-full py-3.5 rounded-xl bg-[#25D366] text-white font-semibold text-base active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg">
                            💬 WhatsApp Confirmation
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    // Empty cart
    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
                <header className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
                    <button onClick={() => navigate('/')}><ChevronLeft size={24} className="text-text-primary" /></button>
                    <h1 className="text-xl font-bold text-text-primary">Checkout</h1>
                </header>
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🛒</div>
                        <h2 className="text-xl font-bold text-text-primary mb-2">Your cart is empty</h2>
                        <p className="text-sm text-text-secondary mb-6">Add some products to get started</p>
                        <button onClick={() => navigate('/')} className="px-6 py-3 rounded-xl bg-primary-dark text-white font-semibold active:scale-95 transition-transform">
                            Browse Products
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F5F5F5] pb-6">
            <header className="bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex items-center gap-3 sticky top-0 z-10 shadow-sm">
                <button onClick={() => navigate('/')} className="active:scale-90 transition-transform">
                    <ChevronLeft size={24} className="text-text-primary" />
                </button>
                <h1 className="text-xl font-bold text-text-primary">Checkout</h1>
            </header>

            <div className="max-w-lg mx-auto">
                {/* Delivery Address */}
                <section className="bg-white p-5 mb-2 mt-2 mx-3 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <MapPin className="text-primary-dark" size={18} />
                            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Delivery Address</h2>
                        </div>
                        {savedCustomer && (
                            <button onClick={clearSavedCustomer} className="text-xs text-red-500 font-semibold hover:text-red-600">
                                Not you?
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-xl p-3">
                            {editingContact ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-primary-dark mb-2">Edit Contact Details</p>
                                    <input
                                        type="text"
                                        placeholder="Your Name"
                                        className="input-field bg-white w-full"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Mobile Number"
                                        className="input-field bg-white w-full"
                                        maxLength={10}
                                        value={editPhone}
                                        onChange={e => setEditPhone(e.target.value.replace(/\D/g, ''))}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (editName.trim()) setName(editName.trim())
                                                if (editPhone.length >= 10) setPhone(editPhone)
                                                const saved = JSON.parse(localStorage.getItem('mrn_customer_data') || '{}')
                                                localStorage.setItem('mrn_customer_data', JSON.stringify({
                                                    ...saved,
                                                    name: editName.trim() || saved.name,
                                                    phone: editPhone.length >= 10 ? editPhone : saved.phone,
                                                }))
                                                setEditingContact(false)
                                            }}
                                            className="flex-1 py-2 rounded-lg bg-primary-dark text-white text-sm font-bold"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingContact(false)}
                                            className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 text-sm font-semibold"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{name}</p>
                                        <p className="text-xs text-gray-500">📱 {phone}</p>
                                    </div>
                                    <button
                                        onClick={() => { setEditName(name); setEditPhone(phone); setEditingContact(true) }}
                                        className="text-xs text-primary-dark font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200"
                                    >
                                        Change Contact
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Address Book UI */}
                        {savedAddresses.length > 0 && (
                            <div className="space-y-3 pt-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Select Delivery Address</label>

                                {savedAddresses.map((addr, index) => (
                                    <div
                                        key={addr.id || index}
                                        onClick={() => handleSelectSavedAddress(index)}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressIndex === index ? 'border-primary-dark bg-primary-dark/5' : 'border-gray-100 bg-white hover:border-gray-300'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedAddressIndex === index ? 'border-primary-dark' : 'border-gray-300'}`}>
                                                    {selectedAddressIndex === index && <div className="w-2 h-2 rounded-full bg-primary-dark" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 mb-0.5">{addr.houseNo}</p>
                                                    <p className="text-xs text-gray-500 line-clamp-2">{addr.area}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div
                                    onClick={handleSelectNewAddressMode}
                                    className={`p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center gap-3 ${isAddingNewAddress ? 'border-primary-dark bg-primary-dark/5' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isAddingNewAddress ? 'border-primary-dark' : 'border-gray-300'}`}>
                                        {isAddingNewAddress && <div className="w-2 h-2 rounded-full bg-primary-dark" />}
                                    </div>
                                    <span className={`text-sm font-bold ${isAddingNewAddress ? 'text-primary-dark' : 'text-gray-600'}`}>+ Add New Address</span>
                                </div>
                            </div>
                        )}

                        {/* Delivery Address Form (Always show so user can edit their currently selected address) */}
                        {true && (
                            <div className="mt-4 p-4 rounded-xl border border-primary-dark/20 bg-emerald-50/50 animate-fadeIn">
                                <h3 className="text-xs font-bold text-primary-dark mb-3 uppercase tracking-wider">Delivery Details (Editable)</h3>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">House No.</label>
                                        <input type="text" placeholder="House no." className="input-field bg-white" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Area / Road</label>
                                        <input type="text" placeholder="Area / Road" className="input-field bg-white" value={area} onChange={(e) => setArea(e.target.value)} />
                                    </div>
                                </div>

                                {/* Map Section inside New Address Form */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Pin Precise Location on Map <span className="text-red-500">*</span></label>

                                    <div className="w-full h-64 rounded-xl mb-3 overflow-hidden border border-gray-200 relative z-0">
                                        <MapContainer
                                            center={mapCenter}
                                            zoom={15}
                                            style={{ height: '100%', width: '100%' }}
                                            zoomControl={false}
                                            attributionControl={false}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            <Marker position={[STORE_LOCATION.lat, STORE_LOCATION.lng]} icon={storeIcon} />
                                            {userLocation && (
                                                <DraggableMarker
                                                    position={userLocation}
                                                    onPositionChange={handleLocationUpdate}
                                                />
                                            )}
                                            <MapClickHandler onLocationSelect={handleLocationUpdate} />
                                        </MapContainer>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={detectLocation}
                                            disabled={detectingGPS}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 font-bold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-sm hover:border-emerald-300"
                                        >
                                            {detectingGPS ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                                                    Detecting...
                                                </>
                                            ) : (
                                                <>
                                                    <Target size={16} />
                                                    Use GPS
                                                </>
                                            )}
                                        </button>

                                        {distance !== null && (
                                            <div className={`flex items-center gap-1.5 text-sm font-semibold ${distance > DELIVERY_RADIUS_KM ? 'text-red-500' : 'text-emerald-600'}`}>
                                                <Navigation size={14} />
                                                {distance.toFixed(2)} km
                                                {distance > DELIVERY_RADIUS_KM && <span className="text-xs text-red-500 ml-1">Out of range!</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Cart Items */}
                <section className="bg-white p-5 mb-2 mx-3 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ShoppingBag className="text-primary-dark" size={18} />
                        <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Your Items</h2>
                        <span className="ml-auto text-xs text-gray-400 font-medium">{items.length} items</span>
                    </div>
                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-12 h-12 object-contain bg-gray-100 rounded-lg p-1 transition-opacity duration-300"
                                    onLoad={(e) => { e.target.style.opacity = 1 }}
                                    style={{ opacity: 0 }}
                                    onError={(e) => { e.target.onerror = null; e.target.style.opacity = 1; e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect fill='%23f5f5f5' width='60' height='60' rx='8'/><text x='30' y='35' text-anchor='middle' fill='%23999' font-size='14'>${encodeURIComponent(item.name.charAt(0))}</text></svg>` }}
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                                    <p className="text-[11px] text-gray-400 uppercase">{item.pack_size} {item.unit} • ₹{item.price}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex items-center border border-gray-200 rounded-lg">
                                        <button
                                            onClick={() => item.qty <= 1 ? removeFromCart(item.id) : decrementQty(item.id)}
                                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
                                        >
                                            {item.qty <= 1 ? <Trash2 size={13} className="text-red-400" /> : <Minus size={13} />}
                                        </button>
                                        <span className="w-6 text-center text-xs font-bold text-gray-900">{item.qty}</span>
                                        <button
                                            onClick={() => incrementQty(item.id)}
                                            className="w-7 h-7 flex items-center justify-center text-primary-dark"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 w-12 text-right">₹{item.price * item.qty}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="space-y-3 pt-4 border-t border-gray-100">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>₹{subtotal}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Delivery Charge</span>
                                <span className={appliedDeliveryCharge === 0 ? 'text-green-600 font-bold' : ''}>
                                    {appliedDeliveryCharge === 0 ? 'Free' : `₹${appliedDeliveryCharge}`}
                                </span>
                            </div>
                            {appliedDeliveryCharge > 0 && minOrderForFreeDelivery > 0 && (
                                <p className="text-xs text-orange-500 text-right">
                                    Add ₹{minOrderForFreeDelivery - subtotal} more for free delivery
                                </p>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                                <span>Total</span>
                                <span className="text-primary-dark">₹{totalAmount}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bundle Suggestions (Frequently Bought Together) */}
                {suggestedProducts.length > 0 && (
                    <section className="bg-white p-5 mb-2 mx-3 rounded-2xl shadow-sm border border-green-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -z-10 opacity-70"></div>

                        <div className="flex items-center gap-2 mb-4">
                            <PackagePlus className="text-emerald-600" size={18} />
                            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-widest">Frequently Bought Together</h2>
                        </div>

                        <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
                            {suggestedProducts.map(product => (
                                <div key={product.id} className="min-w-[140px] max-w-[140px] bg-white border border-gray-100 rounded-xl p-3 snap-start shadow-sm flex flex-col items-center text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-lg p-1.5 flex items-center justify-center mb-2">
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-contain mix-blend-multiply"
                                        />
                                    </div>
                                    <div className="flex-1 w-full flex flex-col justify-end">
                                        <h3 className="text-[11px] font-bold text-gray-900 leading-tight mb-1 line-clamp-2">{product.name}</h3>
                                        <p className="text-[10px] text-gray-500 uppercase flex-1 mb-2">{product.pack_size} {product.unit}</p>
                                        <div className="w-full flex items-center justify-between">
                                            <span className="text-xs font-black text-gray-900">₹{product.price}</span>
                                            <button
                                                onClick={() => {
                                                    addToCart(product)
                                                    toast.success(`Added ${product.name} to cart!`)
                                                }}
                                                className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold active:bg-emerald-100 transition-colors"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="w-full mt-2 pt-2 border-t border-gray-50">
                                        <p className="text-[9px] font-semibold text-emerald-600 truncate">{product.bundleName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Payment Method Selection */}
                <section className="mx-3 space-y-3 mb-6">
                    <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-2">Payment Method</h2>

                    {/* Pay Online */}
                    {RAZORPAY_KEY_ID && (
                        <button
                            onClick={() => setPaymentMethod('online')}
                            className={`w-full flex items-center gap-4 py-4 px-5 rounded-2xl font-bold text-base transition-all duration-200 ${paymentMethod === 'online'
                                ? 'bg-primary-dark text-white shadow-lg shadow-primary-dark/20 ring-2 ring-primary-dark'
                                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-400'
                                }`}
                        >
                            <CreditCard size={22} />
                            <div className="text-left flex-1">
                                <div className="text-sm">Pay Online</div>
                                <div className={`text-[10px] font-medium ${paymentMethod === 'online' ? 'text-white/60' : 'text-gray-400'}`}>
                                    UPI Apps, Cards, Netbanking
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online' ? 'border-white bg-white' : 'border-gray-300'
                                }`}>
                                {paymentMethod === 'online' && <div className="w-2.5 h-2.5 rounded-full bg-primary-dark" />}
                            </div>
                        </button>
                    )}

                    {/* Cash on Delivery */}
                    <button
                        onClick={() => setPaymentMethod('cod')}
                        className={`w-full flex items-center gap-4 py-4 px-5 rounded-2xl font-bold text-base transition-all duration-200 ${paymentMethod === 'cod'
                            ? 'bg-white text-gray-900 border-2 border-gray-900 shadow-sm ring-2 ring-gray-900'
                            : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-400'
                            }`}
                    >
                        <Banknote size={22} />
                        <div className="text-left flex-1">
                            <div className="text-sm">Cash on Delivery</div>
                            <div className={`text-[10px] font-medium ${paymentMethod === 'cod' ? 'text-gray-500' : 'text-gray-400'}`}>
                                Pay when delivered
                            </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cod' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                            }`}>
                            {paymentMethod === 'cod' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                        </div>
                    </button>
                </section>

                {/* Place Order */}
                <div className="mx-3">
                    <button
                        onClick={placeOrder}
                        disabled={!isFormValid() || isSubmitting}
                        className="w-full bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-xl shadow-primary-dark/20 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                {paymentMethod === 'online' ? (
                                    <><CreditCard size={20} /> Pay ₹{totalAmount}</>
                                ) : (
                                    <>Place Order • ₹{totalAmount}</>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}