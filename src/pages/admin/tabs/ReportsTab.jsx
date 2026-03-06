import { useState, useEffect, useMemo } from 'react'
import {
    TrendingUp, ShoppingBag, Users, DollarSign,
    Calendar, ChevronDown, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

export default function ReportsTab() {
    const [orders, setOrders] = useState([])
    const [timeRange, setTimeRange] = useState('today')

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) throw error
                setOrders(data || [])
            } catch (err) {
                // Demo data
                setOrders([
                    { id: 1, total_amount: 330, status: 'Delivered', payment_method: 'COD', created_at: new Date().toISOString(), customer_json: { name: 'A' } },
                    { id: 2, total_amount: 637, status: 'Delivered', payment_method: 'Prepaid', created_at: new Date().toISOString(), customer_json: { name: 'B' } },
                    { id: 3, total_amount: 130, status: 'Delivered', payment_method: 'COD', created_at: new Date().toISOString(), customer_json: { name: 'C' } },
                    { id: 4, total_amount: 450, status: 'Received', payment_method: 'COD', created_at: new Date(Date.now() - 86400000).toISOString(), customer_json: { name: 'D' } },
                    { id: 5, total_amount: 220, status: 'Cancelled', payment_method: 'COD', created_at: new Date(Date.now() - 86400000).toISOString(), customer_json: { name: 'E' } },
                    { id: 6, total_amount: 890, status: 'Delivered', payment_method: 'Prepaid', created_at: new Date(Date.now() - 172800000).toISOString(), customer_json: { name: 'F' } },
                ])
            }
        }
        fetchOrders()
    }, [])

    // Filter by time range
    const filteredOrders = useMemo(() => {
        const now = new Date()
        return orders.filter(order => {
            const orderDate = new Date(order.created_at)
            switch (timeRange) {
                case 'today': return orderDate.toDateString() === now.toDateString()
                case 'week': return (now - orderDate) < 7 * 86400000
                case 'month': return (now - orderDate) < 30 * 86400000
                case 'all': return true
                default: return true
            }
        })
    }, [orders, timeRange])

    // Calculate metrics
    const metrics = useMemo(() => {
        const delivered = filteredOrders.filter(o => o.status === 'Delivered')
        const cancelled = filteredOrders.filter(o => o.status === 'Cancelled')
        const totalRevenue = delivered.reduce((s, o) => s + (o.total_amount || 0), 0)
        const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0
        const uniqueCustomers = new Set(filteredOrders.map(o => o.customer_json?.name)).size
        const codOrders = delivered.filter(o => o.payment_method === 'COD').length
        const prepaidOrders = delivered.filter(o => o.payment_method === 'Prepaid').length

        return {
            totalOrders: filteredOrders.length,
            deliveredOrders: delivered.length,
            cancelledOrders: cancelled.length,
            totalRevenue,
            avgOrderValue: Math.round(avgOrderValue),
            uniqueCustomers,
            codOrders,
            prepaidOrders,
            successRate: filteredOrders.length > 0
                ? Math.round((delivered.length / filteredOrders.length) * 100)
                : 0,
        }
    }, [filteredOrders])

    const StatCard = ({ icon: Icon, label, value, prefix = '', suffix = '', color, trend }) => (
        <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
                    <Icon size={18} style={{ color }} />
                </div>
                {trend && (
                    <span className={`
            text-[10px] font-bold flex items-center gap-0.5
            ${trend > 0 ? 'text-[#00C853]' : 'text-status-cancelled'}
          `}>
                        {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <p className="text-2xl font-extrabold text-text-primary">{prefix}{value.toLocaleString()}{suffix}</p>
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mt-0.5">{label}</p>
        </div>
    )

    return (
        <div className="space-y-4">
            {/* Time Range Selector — Dropdown on mobile, buttons on desktop */}
            <div className="flex items-center gap-2">
                {/* Mobile Dropdown */}
                <div className="sm:hidden relative w-full">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 focus:border-primary-dark"
                    >
                        <option value="today">📅  Today</option>
                        <option value="week">📆  This Week</option>
                        <option value="month">🗓️  This Month</option>
                        <option value="all">📊  All Time</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {/* Desktop Buttons */}
                <div className="hidden sm:flex gap-2">
                    {[
                        { id: 'today', label: 'Today' },
                        { id: 'week', label: 'This Week' },
                        { id: 'month', label: 'This Month' },
                        { id: 'all', label: 'All Time' },
                    ].map(range => (
                        <button
                            key={range.id}
                            onClick={() => setTimeRange(range.id)}
                            className={`
                                px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                                ${timeRange === range.id
                                    ? 'bg-primary-dark text-white shadow-md'
                                    : 'bg-white border border-border text-text-secondary'
                                }
                            `}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Revenue Hero */}
            <div className="bg-linear-to-br from-primary-dark to-primary-medium text-white rounded-2xl p-5 shadow-lg">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Total Revenue</p>
                <p className="text-4xl font-extrabold mt-1">₹{metrics.totalRevenue.toLocaleString()}</p>
                <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#00C853]" />
                        <span className="text-xs text-white/70">{metrics.deliveredOrders} delivered</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-status-cancelled" />
                        <span className="text-xs text-white/70">{metrics.cancelledOrders} cancelled</span>
                    </div>
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={ShoppingBag} label="Total Orders" value={metrics.totalOrders} color="#023430" />
                <StatCard icon={DollarSign} label="Avg Order Value" value={metrics.avgOrderValue} prefix="₹" color="#00C853" />
                <StatCard icon={Users} label="Customers" value={metrics.uniqueCustomers} color="#2196F3" />
                <StatCard icon={TrendingUp} label="Success Rate" value={metrics.successRate} suffix="%" color="#FF9800" />
            </div>

            {/* Payment Split */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                    Payment Methods
                </h3>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-text-primary font-medium">Cash on Delivery</span>
                            <span className="font-bold text-primary-dark">{metrics.codOrders}</span>
                        </div>
                        <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-status-pending rounded-full transition-all duration-500"
                                style={{ width: `${metrics.deliveredOrders > 0 ? (metrics.codOrders / metrics.deliveredOrders) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-text-primary font-medium">Prepaid / Online</span>
                            <span className="font-bold text-primary-dark">{metrics.prepaidOrders}</span>
                        </div>
                        <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-status-out rounded-full transition-all duration-500"
                                style={{ width: `${metrics.deliveredOrders > 0 ? (metrics.prepaidOrders / metrics.deliveredOrders) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Orders Timeline */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                    Recent Activity
                </h3>
                <div className="space-y-3">
                    {filteredOrders.slice(0, 5).map(order => (
                        <div key={order.id} className="flex items-center gap-3">
                            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                ${order.status === 'Delivered' ? 'bg-[#E8F5E9] text-[#00C853]' :
                                    order.status === 'Cancelled' ? 'bg-[#FFEBEE] text-status-cancelled' :
                                        'bg-[#FFF8E1] text-status-pending'}
              `}>
                                <ShoppingBag size={14} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-text-primary">
                                    {order.customer_json?.name || 'Customer'} — ₹{order.total_amount}
                                </p>
                                <p className="text-[10px] text-text-secondary">
                                    {order.status} • {new Date(order.created_at).toLocaleString('en-IN', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>
                    ))}

                    {filteredOrders.length === 0 && (
                        <p className="text-center text-sm text-text-secondary py-4">No orders in this period</p>
                    )}
                </div>
            </div>
        </div>
    )
}
