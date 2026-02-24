import { useState, useEffect, useRef } from 'react'
import {
    Search, Phone, RefreshCw, ChevronDown, ChevronUp,
    MapPin, Package, Bike, Check, X, ExternalLink,
    Clock, CreditCard, Banknote, Loader2, Bell, Navigation
} from 'lucide-react'
import { supabase, STORE_PHONE } from '../../../lib/supabase'
import { toast } from 'sonner'

const STATUS_STYLES = {
    'Received': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'RECEIVED' },
    'Preparing': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'PREPARING' },
    'Out for Delivery': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'OUT FOR DELIVERY' },
    'Delivered': { bg: 'bg-green-100', text: 'text-green-700', label: 'DELIVERED' },
    'Cancelled': { bg: 'bg-red-100', text: 'text-red-700', label: 'CANCELLED' },
}

// Notification sound using Web Audio API
function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

        // Play a pleasant two-tone alert
        const playTone = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator()
            const gain = audioCtx.createGain()
            osc.connect(gain)
            gain.connect(audioCtx.destination)
            osc.frequency.value = freq
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.3, startTime)
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
            osc.start(startTime)
            osc.stop(startTime + duration)
        }

        const now = audioCtx.currentTime
        playTone(880, now, 0.15)       // A5
        playTone(1100, now + 0.15, 0.15) // C#6
        playTone(1320, now + 0.3, 0.2)   // E6
    } catch (e) {
        console.log('Audio notification not available:', e)
    }
}


// Dynamic cart item to pull latest image if historic JSON falls back
function OrderCartItem({ item }) {
    const [imageUrl, setImageUrl] = useState(item.image_url)

    useEffect(() => {
        // Only run fetch if the static JSON has no image, or if we want to force-check
        // Because of the prior image_url wipe, many JSON items have `""`.
        if (!item.image_url && item.id) {
            supabase
                .from('products')
                .select('image_url')
                .eq('id', item.id)
                .single()
                .then(({ data }) => {
                    if (data?.image_url) setImageUrl(data.image_url)
                })
        }
    }, [item])

    return (
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden p-0.5">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.target.onerror = null
                            e.target.style.display = 'none'
                            e.target.parentElement.innerHTML = `<span class="text-gray-300 text-base font-bold">${item.name?.charAt(0) || '?'}</span>`
                        }}
                    />
                ) : (
                    <span className="text-gray-300 text-base font-bold">{item.name?.charAt(0) || '?'}</span>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.pack_size} {item.unit}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
                <p className="font-bold text-sm">x{item.qty}</p>
                <p className="text-xs text-gray-500">₹{item.price * item.qty}</p>
            </div>
        </div>
    )
}

export default function OrdersTab() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [statusFilter, setStatusFilter] = useState('All')
    const prevOrderCountRef = useRef(0)

    // Fetch orders
    const fetchOrders = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setOrders(data || [])
        } catch (err) {
            console.error('Error fetching orders:', err)
            // Demo orders for when Supabase is not connected
            setOrders([
                {
                    id: 1001,
                    customer_json: { name: 'Md Aziz', mobile: '7892936797', house_no: '12', area: 'Main Road, Chittapur', location: { lat: 16.9329, lng: 77.0182 } },
                    cart_json: [
                        { name: 'Fortune Oil', price: 140, qty: 1, pack_size: '1', unit: 'L' },
                        { name: 'Toor Dal', price: 95, qty: 2, pack_size: '1', unit: 'kg' },
                    ],
                    total_amount: 330,
                    payment_method: 'COD',
                    payment_status: 'Unpaid',
                    status: 'Received',
                    created_at: new Date().toISOString(),
                },
                {
                    id: 1002,
                    customer_json: { name: 'Ahmed Khan', mobile: '9876543210', house_no: '45', area: 'Station Road' },
                    cart_json: [
                        { name: 'Aashirvaad Atta', price: 275, qty: 1, pack_size: '5', unit: 'kg' },
                        { name: 'Amul Ghee', price: 290, qty: 1, pack_size: '500', unit: 'ml' },
                    ],
                    total_amount: 637,
                    payment_method: 'Prepaid',
                    payment_status: 'Paid',
                    status: 'Out for Delivery',
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                },
            ])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchOrders() }, [])

    // Realtime listener with notification sound
    useEffect(() => {
        const channel = supabase
            .channel('admin-orders-list')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
            }, (payload) => {
                // New order received — play sound + show toast
                playNotificationSound()
                toast.success('🔔 New order received!', {
                    description: `${payload.new?.customer_json?.name || 'Customer'} — ₹${payload.new?.total_amount || 0}`,
                    duration: 8000,
                })

                // Also try browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🔔 New Order!', {
                        body: `${payload.new?.customer_json?.name} — ₹${payload.new?.total_amount}`,
                        icon: '/vite.svg',
                    })
                }

                fetchOrders()
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
            }, () => {
                fetchOrders()
            })
            .subscribe()

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }

        const interval = setInterval(fetchOrders, 3000)

        return () => {
            channel.unsubscribe()
            clearInterval(interval)
        }
    }, [])

    // Update order status
    const updateStatus = async (orderId, newStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId)

            if (error) throw error

            setOrders(prev =>
                prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
            )
            toast.success(`Order marked as ${newStatus}`)
        } catch (err) {
            setOrders(prev =>
                prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
            )
            toast.success(`Order marked as ${newStatus} (Demo)`)
        }
    }

    // Filter orders
    const filteredOrders = orders.filter(order => {
        // Status filter
        if (statusFilter !== 'All' && order.status !== statusFilter) return false

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            return (
                order.customer_json?.name?.toLowerCase().includes(q) ||
                order.customer_json?.mobile?.includes(q) ||
                String(order.id).includes(q)
            )
        }
        return true
    })

    // Stats
    const stats = {
        total: orders.length,
        received: orders.filter(o => o.status === 'Received').length,
        outForDelivery: orders.filter(o => o.status === 'Out for Delivery').length,
        delivered: orders.filter(o => o.status === 'Delivered').length,
        totalRevenue: orders.filter(o => o.status === 'Delivered').reduce((s, o) => s + (o.total_amount || 0), 0),
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
            ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    // Open Google Maps for a location
    const openMapLink = (location) => {
        if (!location?.lat || !location?.lng) return null
        return `https://www.google.com/maps?q=${location.lat},${location.lng}`
    }

    return (
        <div className="space-y-3">
            {/* ─── Search & Controls ─── */}
            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 flex items-center border border-gray-100">
                        <Search size={16} className="text-gray-400 shrink-0" />
                        <input
                            placeholder="Search order ID, name, phone..."
                            className="bg-transparent w-full ml-2 text-sm font-medium outline-none placeholder:text-gray-400 min-w-0"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchOrders}
                        className="bg-[#023430] text-white px-3 rounded-xl text-xs font-bold shadow hover:bg-green-900 transition-colors flex items-center justify-center shrink-0"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={16} />}
                    </button>
                </div>
            </div>

            {/* ─── Quick Stats ─── */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {[
                    { label: 'Total', value: stats.total, color: '#023430', filter: 'All' },
                    { label: 'New', value: stats.received, color: '#FFC107', filter: 'Received' },
                    { label: 'Out', value: stats.outForDelivery, color: '#2196F3', filter: 'Out for Delivery' },
                    { label: 'Done', value: stats.delivered, color: '#00C853', filter: 'Delivered' },
                ].map(stat => (
                    <button
                        key={stat.label}
                        onClick={() => setStatusFilter(stat.filter)}
                        className={`bg-white rounded-xl p-2 sm:p-3 text-center shadow-sm border transition-all ${statusFilter === stat.filter ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100'
                            }`}
                    >
                        <p className="text-xl sm:text-2xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
                        <p className="text-[9px] sm:text-[10px] font-semibold text-[#757575] uppercase">{stat.label}</p>
                    </button>
                ))}
            </div>

            {/* Revenue Card */}
            <div className="bg-[#023430] text-white rounded-xl p-3 sm:p-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] sm:text-xs text-white/60 font-semibold uppercase">Today's Revenue</p>
                    <p className="text-2xl sm:text-3xl font-extrabold">₹{stats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="text-3xl sm:text-4xl">💰</div>
            </div>

            {/* ─── Order Cards Grid ─── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
                    <p className="text-xs font-bold text-gray-400">Loading...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                    <Package size={48} className="mb-3 opacity-20" />
                    <p className="text-sm font-medium">No orders found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredOrders.map(order => {
                        const style = STATUS_STYLES[order.status] || STATUS_STYLES['Received']

                        return (
                            <div
                                key={order.id}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
                            >
                                {/* Order Header */}
                                <div className="p-3 sm:p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-start">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-bold text-gray-900 text-sm truncate">
                                                {order.customer_json?.name || 'Customer'}
                                            </span>
                                            <span className={`
                                                text-[8px] sm:text-[9px] uppercase font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md tracking-wider shrink-0
                                                ${style.bg} ${style.text}
                                            `}>
                                                {style.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mt-1">
                                            <a
                                                href={`tel:${order.customer_json?.mobile}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-blue-600 flex items-center gap-1"
                                            >
                                                <Phone size={10} />
                                                {order.customer_json?.mobile}
                                            </a>
                                        </div>
                                    </div>
                                    {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Mark as Cancelled?')) updateStatus(order.id, 'Cancelled')
                                            }}
                                            className="text-red-300 hover:text-red-600 transition-colors shrink-0 ml-2"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Order Body */}
                                <div className="p-3 sm:p-4">
                                    <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                        <Clock size={12} />
                                        {formatDate(order.created_at)}
                                    </p>

                                    {/* Delivery Address Preview */}
                                    {order.customer_json?.area && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-2">
                                            <MapPin size={11} className="shrink-0 text-gray-400" />
                                            <span className="truncate">
                                                {order.customer_json.house_no && `${order.customer_json.house_no}, `}
                                                {order.customer_json.area}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-end mb-3">
                                        <div className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">
                                            ₹{order.total_amount}
                                        </div>
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            {order.cart_json?.length || 0} Items • {order.payment_method}
                                            {order.payment_status === 'Paid' && (
                                                <span className="text-green-600 ml-1">✓</span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-auto">
                                        <button
                                            onClick={() => setSelectedOrder(order)}
                                            className="flex-1 bg-white text-gray-700 py-2.5 sm:py-3 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
                                        >
                                            Details
                                        </button>
                                        {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                                            <button
                                                onClick={() => {
                                                    const next = order.status === 'Received' ? 'Out for Delivery' : 'Delivered'
                                                    updateStatus(order.id, next)
                                                }}
                                                className="flex-1 bg-black text-white py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-xs font-bold tracking-wider hover:bg-gray-800 transition-colors"
                                            >
                                                {order.status === 'Received' ? 'Dispatch' : 'Delivered'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ─── Order Detail Modal ─── */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl animate-scaleIn">
                        <div className="bg-gray-50 p-4 sm:p-5 border-b flex justify-between items-center">
                            <h2 className="font-bold text-lg text-gray-900">
                                Order #{String(selectedOrder.id).slice(0, 5)}
                            </h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-black">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-xl text-gray-900">
                                        {selectedOrder.customer_json?.name}
                                    </h3>
                                    <a
                                        href={`tel:${selectedOrder.customer_json?.mobile}`}
                                        className="text-blue-600 font-bold flex items-center gap-1 mt-1 text-sm"
                                    >
                                        <Phone size={14} />
                                        {selectedOrder.customer_json?.mobile}
                                    </a>
                                </div>
                                <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-100">
                                    {selectedOrder.payment_method}
                                </span>
                            </div>

                            {/* Delivery Address */}
                            {selectedOrder.customer_json?.area && (
                                <div className="bg-gray-50 p-3 sm:p-4 rounded-xl mb-4 text-sm border border-gray-100">
                                    <p className="font-bold text-gray-400 text-[10px] uppercase mb-1.5 tracking-wider flex items-center gap-1">
                                        <MapPin size={12} />
                                        Delivery Address
                                    </p>
                                    <p className="text-gray-800 leading-relaxed">
                                        {selectedOrder.customer_json.house_no && `${selectedOrder.customer_json.house_no}, `}
                                        {selectedOrder.customer_json.area}
                                    </p>

                                    {/* Google Maps Link */}
                                    {selectedOrder.customer_json?.location && (
                                        <a
                                            href={openMapLink(selectedOrder.customer_json.location)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                                        >
                                            <Navigation size={12} />
                                            Open in Google Maps
                                            <ExternalLink size={10} />
                                        </a>
                                    )}
                                </div>
                            )}

                            <h4 className="font-bold border-b pb-2 mb-3 text-sm text-gray-900">Items Ordered</h4>
                            <div className="space-y-3">
                                {selectedOrder.cart_json?.map((item, i) => (
                                    <OrderCartItem key={i} item={item} />
                                ))}
                            </div>

                            <div className="flex justify-between items-center mt-6 pt-4 border-t border-dashed border-gray-300">
                                <span className="font-bold text-lg text-gray-900">Total Bill</span>
                                <span className="font-bold text-2xl text-green-700">₹{selectedOrder.total_amount}</span>
                            </div>

                            {/* WhatsApp button */}
                            <a
                                href={`https://wa.me/91${selectedOrder.customer_json?.mobile}?text=Hi ${selectedOrder.customer_json?.name}! Your order %23${selectedOrder.id} is ${selectedOrder.status}.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm active:scale-95 transition-transform"
                            >
                                💬 Message Customer on WhatsApp
                            </a>
                        </div>

                        <div className="p-4 sm:p-5 bg-gray-50 border-t flex gap-3">
                            {selectedOrder.status !== 'Delivered' && selectedOrder.status !== 'Cancelled' && (
                                <>
                                    <button
                                        onClick={() => {
                                            if (confirm('Cancel this order?')) {
                                                updateStatus(selectedOrder.id, 'Cancelled')
                                                setSelectedOrder(null)
                                            }
                                        }}
                                        className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-sm border border-red-100 hover:bg-red-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const next = selectedOrder.status === 'Received' ? 'Out for Delivery' : 'Delivered'
                                            updateStatus(selectedOrder.id, next)
                                            setSelectedOrder(null)
                                        }}
                                        className="flex-1 bg-[#023430] text-white py-3 rounded-xl font-bold text-sm hover:bg-green-900 transition-colors shadow-lg"
                                    >
                                        {selectedOrder.status === 'Received' ? 'Dispatch Order' : 'Complete Delivery'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
