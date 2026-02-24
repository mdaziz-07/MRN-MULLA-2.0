import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Check, Phone, MessageCircle, Share2,
    Package, Bike, MapPin, Clock, ChevronLeft,
    Calendar, ChevronDown, Search, RefreshCw
} from 'lucide-react'
import { supabase, STORE_LOCATION, STORE_PHONE, STORE_NAME } from '../lib/supabase'
import { toast } from 'sonner'
import { useCart } from '../context/CartContext'

const ORDER_STATUSES = ['Received', 'Preparing', 'Out for Delivery', 'Delivered']

const STATUS_CONFIG = {
    'Received': { color: '#FFC107', bg: '#FFF8E1', badgeBg: 'bg-amber-50', badgeText: 'text-amber-600', icon: Package, label: 'Order Received' },
    'Preparing': { color: '#FF9800', bg: '#FFF3E0', badgeBg: 'bg-orange-50', badgeText: 'text-orange-600', icon: Package, label: 'Preparing' },
    'Out for Delivery': { color: '#2196F3', bg: '#E3F2FD', badgeBg: 'bg-blue-50', badgeText: 'text-blue-600', icon: Bike, label: 'Out for Delivery' },
    'Delivered': { color: '#00C853', bg: '#E8F5E9', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600', icon: Check, label: 'Delivered' },
    'Cancelled': { color: '#F44336', bg: '#FFEBEE', badgeBg: 'bg-red-50', badgeText: 'text-red-600', icon: Package, label: 'Cancelled' },
}

export default function TrackOrder() {
    const { orderId } = useParams()
    const navigate = useNavigate()
    const [order, setOrder] = useState(null)
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentStatusIndex, setCurrentStatusIndex] = useState(0)
    const [viewMode, setViewMode] = useState('single') // 'single' or 'list'
    const [filterPeriod, setFilterPeriod] = useState('all') // 'today' or 'all'
    const [mobileInput, setMobileInput] = useState('')
    const [loggedInMobile, setLoggedInMobile] = useState('')
    const [isReordering, setIsReordering] = useState(false)
    const { replaceCart } = useCart()

    // Get saved mobile from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('mrn_customer_data')
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.phone) {
                    setLoggedInMobile(parsed.phone)
                    setMobileInput(parsed.phone)
                }
            }
        } catch { }
    }, [])

    // Fetch single order for tracking
    useEffect(() => {
        if (!orderId) {
            setViewMode('list')
            setLoading(false) // Stop loading immediately — list mode waits for mobile input
            return
        }

        const fetchOrder = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', orderId)
                    .single()

                if (error) throw error
                setOrder(data)
                setCurrentStatusIndex(ORDER_STATUSES.indexOf(data.status))
                setViewMode('single') // Auto open
            } catch (err) {
                console.error('Error fetching order:', err)
                setOrder(null)
            } finally {
                setLoading(false)
            }
        }

        fetchOrder()
        const interval = setInterval(fetchOrder, 3000)
        return () => clearInterval(interval)
    }, [orderId])

    // Fetch orders when mobile is available
    useEffect(() => {
        if (!orderId && loggedInMobile) {
            const fetchOrders = () => fetchOrdersByMobile(loggedInMobile)
            fetchOrders()

            // 3-second automatic refresh
            const interval = setInterval(fetchOrders, 3000)

            // Re-fetch when the app wakes up from background
            window.addEventListener('appResumed', fetchOrders)

            return () => {
                clearInterval(interval)
                window.removeEventListener('appResumed', fetchOrders)
            }
        }
    }, [orderId, loggedInMobile])

    const fetchOrdersByMobile = async (mobile) => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error

            // Filter orders client-side by mobile number (since customer_json is JSONB)
            const myOrders = (data || []).filter(o =>
                o.customer_json?.mobile === mobile
            )
            setOrders(myOrders)
        } catch (err) {
            console.error('Error fetching orders:', err)
            setOrders([])
        } finally {
            setLoading(false)
        }
    }

    // Handle mobile number submit
    const handleMobileSubmit = () => {
        const m = mobileInput.trim()
        if (m.length < 10) return
        setLoggedInMobile(m)
        // Save for future visits
        try {
            const existing = localStorage.getItem('mrn_customer_data')
            const parsed = existing ? JSON.parse(existing) : {}
            parsed.phone = m
            localStorage.setItem('mrn_customer_data', JSON.stringify(parsed))
        } catch { }
    }

    // Realtime subscription for order updates
    useEffect(() => {
        if (!orderId) return

        let channel = null

        const setupSubscription = () => {
            if (channel) supabase.removeChannel(channel)

            channel = supabase
                .channel(`order-${orderId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`,
                }, (payload) => {
                    setOrder(payload.new)
                    setCurrentStatusIndex(ORDER_STATUSES.indexOf(payload.new.status))
                })
                .subscribe()
        }

        setupSubscription()

        // Native App Resume Listener
        window.addEventListener('appResumed', setupSubscription)

        return () => {
            if (channel) supabase.removeChannel(channel)
            window.removeEventListener('appResumed', setupSubscription)
        }
    }, [orderId])

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
            ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const filteredOrders = orders.filter(o => {
        if (filterPeriod === 'today') {
            const today = new Date().toDateString()
            return new Date(o.created_at).toDateString() === today
        }
        return true
    })

    const handleReorder = async (orderToReorder) => {
        setIsReordering(true)
        try {
            // 1. Get all product IDs from the past order
            // Exclude print orders or special items if necessary.
            const previousItems = orderToReorder.cart_json || []
            const itemIds = previousItems.map(item => item.id).filter(id => id)

            if (itemIds.length === 0) {
                toast.error('No valid items to reorder.')
                setIsReordering(false)
                return
            }

            // 2. Fetch the LATEST prices and details from the products table
            const { data: latestProducts, error } = await supabase
                .from('products')
                .select('*')
                .in('id', itemIds)

            if (error) throw error

            // 3. Match them up and build a new cart array
            const newCartItems = []
            let unavailableCount = 0

            previousItems.forEach(prevItem => {
                const liveProduct = latestProducts.find(p => p.id === prevItem.id)
                if (liveProduct) {
                    newCartItems.push({
                        ...liveProduct, // Get all the latest info including price/image
                        qty: prevItem.qty // Keep the old quantity
                    })
                } else {
                    unavailableCount++
                }
            })

            // 4. Replace the cart
            if (newCartItems.length === 0) {
                toast.error('Sorry, all items from this order are currently unavailable.')
            } else {
                replaceCart(newCartItems)
                if (unavailableCount > 0) {
                    toast.warning(`${unavailableCount} item(s) are no longer available and were skipped. Prices have been updated.`)
                } else {
                    toast.success('Cart updated with latest prices!')
                }
                setTimeout(() => navigate('/checkout'), 500)
            }
        } catch (err) {
            console.error('Error during reorder:', err)
            toast.error('Failed to reorder items.')
        } finally {
            setIsReordering(false)
        }
    }

    // Loading screen
    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-3 border-gray-200 border-t-[#023430] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    // ─── MOBILE LOGIN SCREEN (for My Orders list) ───
    if (viewMode === 'list' && !loggedInMobile) {
        return (
            <div className="min-h-screen bg-[#F5F5F5]">
                <header className="bg-white px-4 py-4 safe-area-top flex items-center gap-3 sticky top-0 z-10 shadow-sm">
                    <button onClick={() => navigate('/')} className="active:scale-90 transition-transform">
                        <ChevronLeft size={24} className="text-gray-800" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
                </header>

                <div className="max-w-sm mx-auto px-4 py-16 text-center">
                    <div className="text-5xl mb-4">📱</div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Enter Your Mobile Number</h2>
                    <p className="text-sm text-gray-500 mb-6">To view your orders, enter the mobile number you used while placing orders</p>

                    <input
                        type="tel"
                        placeholder="Enter 10-digit mobile number"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                        className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 text-center text-lg font-semibold tracking-widest focus:border-[#023430] focus:outline-none transition-colors mb-4"
                    />

                    <button
                        onClick={handleMobileSubmit}
                        disabled={mobileInput.length < 10}
                        className="w-full py-3.5 rounded-xl bg-[#023430] text-white font-bold text-base disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-95 transition-transform"
                    >
                        <Search size={16} className="inline mr-2" />
                        View My Orders
                    </button>
                </div>
            </div>
        )
    }

    // ─── MY ORDERS LIST VIEW ───
    if (viewMode === 'list' || !orderId) {
        return (
            <div className="min-h-screen bg-[#F5F5F5]">
                {/* Header */}
                <header className="bg-white px-4 py-4 safe-area-top flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="active:scale-90 transition-transform">
                            <ChevronLeft size={24} className="text-gray-800" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
                            <p className="text-[11px] text-gray-400">{loggedInMobile}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setLoggedInMobile('')
                            setMobileInput('')
                            setOrders([])
                        }}
                        className="text-red-500 font-semibold text-sm hover:text-red-600"
                    >
                        Change
                    </button>
                </header>

                {/* Filter Tabs */}
                <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
                    <button
                        onClick={() => setFilterPeriod('today')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filterPeriod === 'today'
                            ? 'bg-[#1A1A1A] text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setFilterPeriod('all')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filterPeriod === 'all'
                            ? 'bg-[#1A1A1A] text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        All Time
                    </button>
                </div>

                {/* Orders List */}
                <div className="max-w-lg mx-auto px-3 py-4 space-y-3">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="text-5xl mb-3">📦</div>
                            <p className="text-gray-500 font-medium">No orders found</p>
                            <p className="text-sm text-gray-400 mt-1">Orders placed with this number will appear here</p>
                        </div>
                    ) : (
                        filteredOrders.map(o => {
                            const config = STATUS_CONFIG[o.status] || STATUS_CONFIG['Received']
                            return (
                                <div
                                    key={o.id}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                                >
                                    {/* Order Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                                Order ID: #{String(o.id).slice(0, 6).toUpperCase()}
                                            </p>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {formatDate(o.created_at)}
                                            </p>
                                        </div>
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${config.badgeBg} ${config.badgeText}`}>
                                            {config.label.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Order Items */}
                                    <div className="space-y-2.5 mb-3">
                                        {o.cart_json?.map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden p-1">
                                                    {item.image_url ? (
                                                        <img
                                                            src={item.image_url}
                                                            alt={item.name}
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => {
                                                                e.target.onerror = null
                                                                e.target.style.display = 'none'
                                                                e.target.parentElement.innerHTML = `<span class="text-gray-300 text-lg font-bold">${item.name.charAt(0)}</span>`
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-300 text-lg font-bold">{item.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                                    <p className="text-[11px] text-gray-400">
                                                        {item.qty} x {item.pack_size}{item.unit}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-bold text-gray-900 shrink-0">₹{item.price * item.qty}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total */}
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-100 mb-3">
                                        <span className="text-sm text-gray-500 font-medium">Total Amount</span>
                                        <span className="text-lg font-black text-[#023430]">₹{o.total_amount}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleReorder(o)
                                            }}
                                            disabled={isReordering}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border-2 border-[#023430] text-[#023430] font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw size={14} className={isReordering ? 'animate-spin' : ''} />
                                            {isReordering ? 'Wait...' : 'Reorder'}
                                        </button>
                                        {o.status !== 'Delivered' && (
                                            <button
                                                onClick={() => navigate(`/track/${o.id}`)}
                                                className="flex-1 py-2.5 rounded-xl bg-[#023430] text-white font-bold text-sm active:scale-95 transition-transform text-center shadow-sm"
                                            >
                                                Track
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        )
    }

    // ─── SINGLE ORDER TRACKING VIEW ───
    if (!order) {
        return (
            <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="text-5xl mb-4">📦</div>
                    <h2 className="text-xl font-bold mb-2">Order not found</h2>
                    <button onClick={() => navigate('/')} className="text-[#023430] font-semibold underline">
                        Go Home
                    </button>
                </div>
            </div>
        )
    }

    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG['Received']
    const StatusIcon = statusConfig.icon

    return (
        <div className="min-h-screen bg-[#F5F5F5]">
            {/* ─── Header ─── */}
            <header className="bg-[#023430] text-white px-4 py-4 safe-area-top flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/orders')} className="active:scale-90 transition-transform">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">Track Order</h1>
                        <p className="text-[11px] text-white/60 font-mono">#{orderId}</p>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        const trackUrl = `${window.location.origin}/track/${orderId}`;
                        const shareData = {
                            title: `Order #${orderId}`,
                            text: `Track my order from ${STORE_NAME}`,
                            url: trackUrl,
                        };
                        try {
                            // Try native share first (works on some Android browsers)
                            if (navigator.share && navigator.canShare?.(shareData)) {
                                await navigator.share(shareData);
                            } else {
                                // Fallback: copy link to clipboard
                                await navigator.clipboard.writeText(trackUrl);
                                toast.success('📋 Link copied! Paste it to share.');
                            }
                        } catch (e) {
                            // Final fallback if clipboard also fails
                            try {
                                await navigator.clipboard.writeText(trackUrl);
                                toast.success('📋 Link copied!');
                            } catch {
                                toast.error('Could not share. Try copying manually.');
                            }
                        }
                    }}
                    className="px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-semibold active:scale-90 transition-transform"
                >
                    <Share2 size={14} className="inline mr-1" />
                    Share
                </button>
            </header>

            {/* ─── Status Hero ─── */}
            <div className="bg-[#023430] text-white px-6 pb-8 pt-4 text-center">
                <div className={`
                    w-20 h-20 rounded-full mx-auto mb-4
                    flex items-center justify-center
                    ${order.status === 'Delivered' ? 'bg-[#00C853]' :
                        order.status === 'Out for Delivery' ? 'bg-[#2196F3] animate-pulse' :
                            'bg-[#FFC107]'}
                    shadow-[0_0_30px_rgba(255,255,255,0.15)]
                `}>
                    <StatusIcon size={36} className="text-white" />
                </div>

                <h2 className="text-2xl font-extrabold mb-1">{statusConfig.label}</h2>

                {order.status === 'Out for Delivery' && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <Clock size={14} className="text-white/60" />
                        <span className="text-sm text-white/70">Estimated: 5-10 mins</span>
                    </div>
                )}

                {order.status === 'Delivered' && (
                    <p className="text-sm text-white/70 mt-1">Thank you for ordering! 🎉</p>
                )}
            </div>

            {/* ─── Reorder Button (Removed from here, now in My Orders List) ─── */}

            {/* ─── Status Timeline ─── */}
            <div className="bg-white p-6 -mt-2 rounded-t-3xl relative z-10">
                <h3 className="text-sm font-semibold text-[#757575] uppercase tracking-wider mb-5">
                    Order Timeline
                </h3>

                <div className="relative space-y-7 ml-3">
                    <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[#E0E0E0]" />
                    <div
                        className={`absolute left-[7px] top-2 w-[2px] bg-gradient-to-b from-[#00C853] to-[#00C853] transition-all duration-700 ${order.status === 'Delivered' ? 'bottom-2' : ''}`}
                        style={{ height: order.status === 'Delivered' ? 'auto' : `${Math.max(0, currentStatusIndex) * 33.33}%` }}
                    />

                    {ORDER_STATUSES.map((status, index) => {
                        const isCompleted = index <= currentStatusIndex
                        const isCurrent = index === currentStatusIndex
                        const config = STATUS_CONFIG[status]

                        return (
                            <div key={status} className="flex items-start gap-4 relative">
                                <div className={`
                                    w-4 h-4 rounded-full z-10 flex items-center justify-center transition-all duration-500
                                    ${isCompleted ? 'bg-[#00C853] shadow-[0_0_8px_rgba(0,200,83,0.4)]' : 'bg-[#E0E0E0]'}
                                    ${isCurrent ? 'ring-4 ring-[#00C853]/20 scale-125' : ''}
                                `}>
                                    {isCompleted && <Check size={10} className="text-white" />}
                                </div>

                                <div className="flex-1 -mt-0.5">
                                    <p className={`font-semibold text-[15px] ${isCurrent ? 'text-[#023430]' : isCompleted ? 'text-[#1A1A1A]' : 'text-[#BDBDBD]'}`}>
                                        {config.label}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${isCompleted ? 'text-[#757575]' : 'text-[#BDBDBD]'}`}>
                                        {isCompleted
                                            ? new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                            : isCurrent && order.status !== 'Delivered' ? 'In progress...' : 'Pending'}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ─── Order Details ─── */}
            <div className="bg-white p-6 mt-2">
                <h3 className="text-sm font-semibold text-[#757575] uppercase tracking-wider mb-4">
                    Order Details
                </h3>

                <div className="space-y-3 mb-4">
                    {order.cart_json?.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden p-1">
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-gray-300 text-sm font-bold">{item.name.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-[#1A1A1A]">{item.name}</p>
                                <p className="text-[11px] text-[#757575]">{item.pack_size} {item.unit} × {item.qty}</p>
                            </div>
                            <span className="text-sm font-bold text-[#023430]">₹{item.price * item.qty}</span>
                        </div>
                    ))}
                </div>

                <div className="border-t border-[#E0E0E0] pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-[#757575]">Payment</span>
                        <span className="font-medium">
                            {order.payment_method}
                            {order.payment_status === 'Paid' && (
                                <span className="ml-1 text-[#00C853] text-xs">✓ Paid</span>
                            )}
                        </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#E0E0E0]">
                        <span>Total</span>
                        <span className="text-[#023430]">₹{order.total_amount}</span>
                    </div>
                </div>
            </div>

            {/* ─── Help Actions ─── */}
            <div className="p-4 flex gap-3 pb-8">
                <a
                    href={`tel:${STORE_PHONE}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white border-2 border-[#023430] text-[#023430] font-semibold active:scale-95 transition-transform shadow-sm"
                >
                    <Phone size={18} />
                    Call Store
                </a>

                <a
                    href={`https://wa.me/91${STORE_PHONE}?text=Hi, I need help with order %23${orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#25D366] text-white font-semibold active:scale-95 transition-transform shadow-[0_2px_8px_rgba(37,211,102,0.3)]"
                >
                    <MessageCircle size={18} />
                    WhatsApp
                </a>
            </div>
        </div>
    )
}
