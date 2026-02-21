import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ChevronLeft, MapPin, ShoppingBag, CreditCard, Banknote,
    Target, Navigation, CheckCircle, Trash2, Plus, Minus
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useCart } from '../context/CartContext'
import { supabase, STORE_LOCATION, DELIVERY_RADIUS_KM, STORE_PHONE, RAZORPAY_KEY_ID, STORE_NAME } from '../lib/supabase'
import { toast } from 'sonner'

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

// --- NEW: Helper to dynamically load Razorpay ---
const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

export default function Checkout() {
    const navigate = useNavigate()
    const { items, incrementQty, decrementQty, removeFromCart, clearCart } = useCart()

    // Load saved customer data
    const savedCustomer = (() => {
        try {
            const saved = localStorage.getItem('mrn_customer_data')
            return saved ? JSON.parse(saved) : null
        } catch { return null }
    })()

    // Form state — pre-fill from saved data
    const [phone, setPhone] = useState(savedCustomer?.phone || '')
    const [name, setName] = useState(savedCustomer?.name || '')
    const [houseNo, setHouseNo] = useState(savedCustomer?.houseNo || '')
    const [area, setArea] = useState(savedCustomer?.area || '')
    const [paymentMethod, setPaymentMethod] = useState('cod')
    const [userLocation, setUserLocation] = useState(savedCustomer?.location || null)
    const [distance, setDistance] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [detectingGPS, setDetectingGPS] = useState(false)
    const [orderPlaced, setOrderPlaced] = useState(false)
    const [orderId, setOrderId] = useState(null)
    const [deliveryCharge, setDeliveryCharge] = useState(0)
    const [minOrderForFreeDelivery, setMinOrderForFreeDelivery] = useState(0)

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0)
    const totalAmount = subtotal + deliveryCharge

    const [mapCenter, setMapCenter] = useState(
        savedCustomer?.location
            ? [savedCustomer.location.lat, savedCustomer.location.lng]
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

    // Auto-fill address from last order when phone number is entered
    useEffect(() => {
        if (phone.length === 10) {
            const fetchLastAddress = async () => {
                const { data, error } = await supabase
                    .from('orders')
                    .select('customer_json')
                    .eq('customer_json->>mobile', phone)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (data?.customer_json) {
                    const c = data.customer_json
                    if (c.name) setName(c.name)
                    if (c.house_no) setHouseNo(c.house_no)
                    if (c.area) setArea(c.area)
                    if (c.location) handleLocationUpdate(c.location)
                    toast.success('📍 Address autofilled from last order!')
                }
            }
            fetchLastAddress()
        }
    }, [phone])

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
            localStorage.setItem('mrn_customer_data', JSON.stringify({
                phone: phone.trim(),
                name: name.trim(),
                houseNo: houseNo.trim(),
                area: area.trim(),
                location: userLocation,
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

    // --- UPDATED: Secure Razorpay payment handler with UPI Intent ---
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
            // 1. Load the Razorpay SDK
            const res = await loadRazorpayScript()
            if (!res) {
                toast.error('Razorpay SDK failed to load. Are you online?')
                setIsSubmitting(false)
                return
            }

            // 2. Call secure Edge Function (Sending ONLY ids and quantities)
            const secureCartPayload = items.map(item => ({
                id: item.id,
                quantity: item.qty
            }))

            const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
                body: { cart: secureCartPayload, deliveryFee: deliveryCharge }
            })

            if (orderError || !orderData?.success) {
                console.error('Backend Payment Error:', orderError || orderData?.error)
                toast.error('RAW ERROR: ' + JSON.stringify(orderError || orderData?.error || "Network/CORS Error"))
                setIsSubmitting(false)
                return
            }

            // 3. Open Razorpay Checkout Window with UPI Intent
            const options = {
                key: razorpayKey,
                amount: orderData.amount, // Secured amount from backend
                currency: 'INR',
                name: STORE_NAME || 'MRN Mulla Kirana',
                description: `Order - ${items.length} items`,
                order_id: orderData.orderId, // Generated by Backend

                // Forces UPI Intent apps (GPay, PhonePe) to open directly on mobile
                webview_intent: true,

                prefill: {
                    name: name.trim(),
                    contact: phone.trim(), // Razorpay uses this to remember saved UPI IDs
                },

                // Prioritizes the UPI block visually
                config: {
                    display: {
                        blocks: {
                            upi: {
                                name: "Pay via UPI Apps",
                                instruments: [
                                    { method: "upi" }
                                ]
                            }
                        },
                        sequence: ["block.upi"],
                        preferences: {
                            show_default_blocks: true
                        }
                    }
                },

                theme: {
                    color: '#023430',
                },
                handler: async function (response) {
                    // PAYMENT SUCCESS
                    try {
                        const newOrderId = await insertOrder('Online', 'Paid')
                        setOrderId(newOrderId)
                        setOrderPlaced(true)
                        saveCustomerData()
                        clearCart()
                        toast.success('Payment Successful! Order placed. 🎉')
                    } catch (err) {
                        console.error('Order insert failed after payment:', err)
                        toast.error('Error recording order. Payment ID: ' + response.razorpay_payment_id)
                    } finally {
                        setIsSubmitting(false)
                    }
                },
                modal: {
                    ondismiss: function () {
                        setIsSubmitting(false)
                        toast.info('Payment cancelled')
                    }
                }
            }

            const razorpay = new window.Razorpay(options)
            razorpay.on('payment.failed', function (response) {
                setIsSubmitting(false)
                toast.error('Payment failed: ' + (response.error?.description || 'Try again'))
            })
            razorpay.open()

        } catch (err) {
            console.error('Razorpay process error:', err)
            setIsSubmitting(false)
            toast.error('Payment initialization failed.')
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
            <div className="min-h-screen bg-[#023430] flex items-center justify-center p-6">
                <div className="text-center animate-scaleIn">
                    <div className="w-24 h-24 rounded-full bg-[#00C853] text-white flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(0,200,83,0.3)]">
                        <CheckCircle size={48} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-2">Order Placed! 🎉</h1>
                    <p className="text-white/70 text-base mb-2">Your order has been received</p>
                    <p className="text-white/50 text-sm mb-8 font-mono">Order ID: #{orderId}</p>
                    <div className="space-y-3 max-w-xs mx-auto">
                        <button onClick={() => navigate(`/track/${orderId}`)} className="w-full py-3.5 rounded-xl bg-white text-[#023430] font-bold text-base active:scale-95 transition-transform shadow-lg">
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
                    <button onClick={() => navigate('/')}><ChevronLeft size={24} className="text-[#1A1A1A]" /></button>
                    <h1 className="text-xl font-bold text-[#1A1A1A]">Checkout</h1>
                </header>
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🛒</div>
                        <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Your cart is empty</h2>
                        <p className="text-sm text-[#757575] mb-6">Add some products to get started</p>
                        <button onClick={() => navigate('/')} className="px-6 py-3 rounded-xl bg-[#023430] text-white font-semibold active:scale-95 transition-transform">
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
                    <ChevronLeft size={24} className="text-[#1A1A1A]" />
                </button>
                <h1 className="text-xl font-bold text-[#1A1A1A]">Checkout</h1>
            </header>

            <div className="max-w-lg mx-auto">
                {/* Delivery Address */}
                <section className="bg-white p-5 mb-2 mt-2 mx-3 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <MapPin className="text-[#023430]" size={18} />
                            <h2 className="text-xs font-bold text-[#757575] uppercase tracking-widest">Delivery Address</h2>
                        </div>
                        {savedCustomer && (
                            <button onClick={clearSavedCustomer} className="text-xs text-red-500 font-semibold hover:text-red-600">
                                Not you?
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {savedCustomer?.phone && savedCustomer?.name ? (
                            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{name}</p>
                                    <p className="text-xs text-gray-500">📱 {phone}</p>
                                </div>
                                <button onClick={clearSavedCustomer} className="text-xs text-[#023430] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200">Edit</button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                                    <input type="tel" placeholder="Enter 10-digit number" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
                                    <input type="text" placeholder="Enter your full name" className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                            </>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">House No.</label>
                                <input type="text" placeholder="House no." className="input-field" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Area / Road</label>
                                <input type="text" placeholder="Area / Road" className="input-field" value={area} onChange={(e) => setArea(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Map Section */}
                    <div className="mt-5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Pin Location on Map</label>

                        <div className="w-full h-80 rounded-xl mb-3 overflow-hidden border border-gray-200 relative z-0">
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
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-sm hover:border-gray-300"
                            >
                                {detectingGPS ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
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
                                    {distance > DELIVERY_RADIUS_KM && <span className="text-xs text-red-400 ml-1">Out of range!</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Cart Items */}
                <section className="bg-white p-5 mb-2 mx-3 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ShoppingBag className="text-[#023430]" size={18} />
                        <h2 className="text-xs font-bold text-[#757575] uppercase tracking-widest">Your Items</h2>
                        <span className="ml-auto text-xs text-gray-400 font-medium">{items.length} items</span>
                    </div>
                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-12 h-12 object-contain bg-gray-50 rounded-lg p-1"
                                    onError={(e) => { e.target.onerror = null; e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect fill='%23f5f5f5' width='60' height='60' rx='8'/><text x='30' y='35' text-anchor='middle' fill='%23999' font-size='14'>${encodeURIComponent(item.name.charAt(0))}</text></svg>` }}
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
                                            className="w-7 h-7 flex items-center justify-center text-[#023430]"
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
                                <span className={deliveryCharge === 0 ? 'text-green-600 font-bold' : ''}>
                                    {deliveryCharge === 0 ? 'Free' : `₹${deliveryCharge}`}
                                </span>
                            </div>
                            {deliveryCharge > 0 && (
                                <p className="text-xs text-orange-500 text-right">
                                    Add ₹{minOrderForFreeDelivery - subtotal} more for free delivery
                                </p>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                                <span>Total</span>
                                <span className="text-[#023430]">₹{totalAmount}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Payment Method Selection */}
                <section className="mx-3 space-y-3 mb-6">
                    <h2 className="text-xs font-bold text-[#757575] uppercase tracking-widest px-2">Payment Method</h2>

                    {/* Pay Online */}
                    {RAZORPAY_KEY_ID && (
                        <button
                            onClick={() => setPaymentMethod('online')}
                            className={`w-full flex items-center gap-4 py-4 px-5 rounded-2xl font-bold text-base transition-all duration-200 ${paymentMethod === 'online'
                                ? 'bg-[#023430] text-white shadow-lg shadow-[#023430]/20 ring-2 ring-[#023430]'
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
                                {paymentMethod === 'online' && <div className="w-2.5 h-2.5 rounded-full bg-[#023430]" />}
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
                        className="w-full bg-[#023430] text-white py-4 rounded-2xl font-bold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-xl shadow-[#023430]/20 flex items-center justify-center gap-2"
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