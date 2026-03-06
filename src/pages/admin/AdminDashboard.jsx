import { useState, useEffect, useCallback } from 'react'
import {
    RefreshCw, Power, ShoppingBag, X, Bell, Mic, Package, BarChart3,
    Menu, ChevronLeft, Store, Lock, Settings, Printer
} from 'lucide-react'
import SettingsTab from './tabs/SettingsTab'
import { supabase } from '../../lib/supabase'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { LocalNotifications } from '@capacitor/local-notifications'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import PrintRequestsTab from './tabs/PrintRequestsTab'
import { toast } from 'sonner'
import { CATEGORIES } from '../../data/products'
import OrdersTab from './tabs/OrdersTab'
import ProductsTab from './tabs/ProductsTab'
import ReportsTab from './tabs/ReportsTab'
import AITab from './tabs/AITab'
import BundlesTab from './tabs/BundlesTab'

const TABS = [
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'print', label: 'Print', icon: Printer },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'bundles', label: 'Bundles', icon: ShoppingBag },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'voice', label: 'Voice AI', icon: Mic },
    { id: 'settings', label: 'Settings', icon: Settings },
]

// Bottom tabs exclude Settings and Bundles (moved to hamburger menu only)
const BOTTOM_TABS = TABS.filter(t => t.id !== 'settings' && t.id !== 'bundles')

export default function AdminDashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('orders')
    const [refreshKey, setRefreshKey] = useState(0)
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [newOrderCount, setNewOrderCount] = useState(0)
    const [showNotif, setShowNotif] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState('')
    const productCategories = CATEGORIES.filter(c => c.name !== 'All').map(c => c.name)
    const [shopOpen, setShopOpen] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [pinInput, setPinInput] = useState('')

    // Check for saved admin session
    useEffect(() => {
        if (localStorage.getItem('mrn_admin_auth') === 'true') {
            setIsAuthenticated(true)
        }

        // Keep screen awake
        KeepAwake.keepAwake().catch(() => console.log('KeepAwake not supported'))

        return () => {
            KeepAwake.allowSleep().catch(() => { })
        }
    }, [])

    // Fetch initial shop status
    useEffect(() => {
        const fetchStatus = async () => {
            const { data } = await supabase
                .from('store_settings')
                .select('value')
                .eq('key', 'shop_open')
                .single()
            if (data) setShopOpen(data.value === 'true')
        }
        fetchStatus()

        // Real-time subscription
        const channel = supabase
            .channel('store_settings_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'store_settings',
                filter: 'key=eq.shop_open'
            }, (payload) => {
                const newVal = payload.new?.value === 'true'
                setShopOpen(newVal)
            })
            .subscribe()

        return () => channel.unsubscribe()
    }, [])

    const toggleShopStatus = async () => {
        const newStatus = !shopOpen
        setShopOpen(newStatus) // optimistic update

        // Use RPC function to bypass table 404 issues
        const { error } = await supabase.rpc('update_shop_status', {
            new_status: String(newStatus)
        })

        if (error) {
            console.error('RPC Error:', error)
            // Fallback to table update if RPC fails (e.g. user hasn't run SQL yet)
            const { error: tableError } = await supabase
                .from('store_settings')
                .upsert({ key: 'shop_open', value: String(newStatus) }, { onConflict: 'key' })

            if (tableError) {
                console.error('Table Error:', tableError)
                toast.error('Failed to update status')
                setShopOpen(!newStatus) // revert
                return
            }
        }

        toast.success(newStatus ? '🟢 Shop is now OPEN' : '🔴 Shop is now CLOSED')
    }

    // Online/offline detection
    useEffect(() => {
        const onOnline = () => setIsOnline(true)
        const onOffline = () => setIsOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    // Notification sound
    const playNotifSound = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const playTone = (freq, start, dur) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.frequency.value = freq
                osc.type = 'sine'
                gain.gain.setValueAtTime(0.3, start)
                gain.gain.exponentialRampToValueAtTime(0.01, start + dur)
                osc.start(start)
                osc.stop(start + dur)
            }
            const now = ctx.currentTime
            playTone(880, now, 0.15)
            playTone(1100, now + 0.15, 0.15)
            playTone(1320, now + 0.3, 0.2)
        } catch (e) { console.log('Audio not available') }
    }, [])

    // Request notification permission & Create Channel for Local Notifications
    useEffect(() => {
        const setupNotifications = async () => {
            const perm = await LocalNotifications.requestPermissions()
            if (perm.display === 'granted') {
                // Create High Priority Channel for Android Local Notifications
                await LocalNotifications.createChannel({
                    id: 'orders',
                    name: 'New Orders',
                    description: 'Notifications for new orders',
                    importance: 5, // High
                    visibility: 1, // Public
                    sound: 'loud_alarm.wav',
                    vibration: true,
                })
            }
        }
        setupNotifications()
    }, [])

    // Real-time order notification via WebSocket
    useEffect(() => {
        const channel = supabase
            .channel('admin-new-orders')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
            }, async (payload) => {
                setNewOrderCount(prev => prev + 1)
                setShowNotif(true)

                // Play notification sound (Web Audio)
                playNotifSound()

                // TTS Alert
                try {
                    await TextToSpeech.speak({
                        text: 'New Order Received! Check now.',
                        lang: 'en-IN',
                        rate: 1.0,
                        pitch: 1.1,
                        volume: 1.0,
                        category: 'ambient',
                    })
                } catch (e) {
                    const utterance = new SpeechSynthesisUtterance('New Order Received! Check now.')
                    utterance.rate = 1.0
                    utterance.pitch = 1.1
                    utterance.volume = 1.0
                    window.speechSynthesis.speak(utterance)
                }

                // Capacitor Local Notification (only needed if you want a system tray alert while app is open)
                await LocalNotifications.schedule({
                    notifications: [{
                        title: '🛒 New Order Received!',
                        body: `Order #${String(payload.new.id).slice(0, 6)} - ₹${payload.new.total_amount}`,
                        id: Math.floor(Date.now() / 1000) % 2147483647,
                        schedule: { at: new Date(Date.now() + 100) },
                        sound: 'loud_alarm.wav',
                        attachments: null,
                        actionTypeId: '',
                        extra: null,
                        channelId: 'orders', // Matches created channel
                    }]
                })

                if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])

                // UI Toast
                toast.success(`New Order! #${String(payload.new.id).slice(0, 6)}`, {
                    description: `Amount: ₹${payload.new.total_amount}`,
                    action: {
                        label: 'View',
                        onClick: () => setActiveTab('orders'),
                    },
                })
            })
            .subscribe()

        return () => channel.unsubscribe()
    }, [playNotifSound])

    const handleRefresh = useCallback(() => {
        setRefreshKey(prev => prev + 1)
        setNewOrderCount(0)
        setShowNotif(false)
        toast.success('Refreshed!')
    }, [])

    const handleTabClick = (tabId) => {
        setActiveTab(tabId)
        setSidebarOpen(false)
    }

    const handleLogout = () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('mrn_admin_auth')
            setIsAuthenticated(false)
            onLogout()
        }
    }

    // ─── PIN LOCK SCREEN ───
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-xs w-full text-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} className="text-primary-dark" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Admin Locked</h2>
                    <p className="text-sm text-gray-500 mb-6">Enter PIN to access dashboard</p>

                    <form onSubmit={(e) => {
                        e.preventDefault()
                        if (pinInput === '1234') {
                            localStorage.setItem('mrn_admin_auth', 'true')
                            setIsAuthenticated(true)
                            toast.success('Unlocked')
                        } else {
                            toast.error('Incorrect PIN')
                            setPinInput('')
                        }
                    }}>
                        <input
                            type="password"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 text-center text-2xl font-bold tracking-[0.5em] mb-4 focus:border-primary-dark focus:outline-none"
                            placeholder="••••"
                            maxLength={4}
                            inputMode="numeric"
                            autoFocus
                        />
                        <button className="w-full bg-primary-dark text-white py-3.5 rounded-xl font-bold active:scale-95 transition-transform">
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex overflow-x-hidden">
            {/* ─── Desktop Sidebar ─── */}
            <aside className="hidden lg:flex flex-col w-64 bg-primary-dark text-white fixed h-full z-50 shadow-xl pt-[env(safe-area-inset-top)]">
                {/* Logo Area */}
                <div className="p-6 border-b border-white/10">
                    <h1 className="text-xl font-black tracking-tight">MRN MULLA</h1>
                    <p className="text-xs text-white/50 mt-0.5 font-medium">Admin Panel</p>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 py-4 px-3 space-y-1">
                    {TABS.filter(t => t.id === 'bundles' || t.id === 'settings').map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all
                                    ${isActive
                                        ? 'bg-white text-primary-dark shadow-lg'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                {tab.image ? (
                                    <img src={tab.image} alt={tab.label} className="w-5 h-5 object-contain" />
                                ) : (
                                    Icon && <Icon size={20} />
                                )}
                                {tab.label}
                                {tab.id === 'orders' && newOrderCount > 0 && (
                                    <span className={`ml-auto text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${isActive ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {newOrderCount}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-xs text-white/60">{isOnline ? 'Connected' : 'Offline'}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                        <Power size={16} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* ─── Mobile Sidebar Overlay ─── */}
            {sidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setSidebarOpen(false)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <aside
                        className="relative w-72 bg-primary-dark text-white h-full flex flex-col shadow-xl animate-slideRight pt-[env(safe-area-inset-top)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h1 className="text-xl font-black tracking-tight">MRN MULLA</h1>
                                <p className="text-xs text-white/50 mt-0.5 font-medium">Admin Panel</p>
                            </div>
                            <button onClick={() => setSidebarOpen(false)} className="text-white/50 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex-1 py-4 px-3 space-y-1">
                            {TABS.filter(t => t.id === 'bundles' || t.id === 'settings').map(tab => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabClick(tab.id)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all
                                            ${isActive
                                                ? 'bg-white text-primary-dark shadow-lg'
                                                : 'text-white/70 hover:bg-white/10 hover:text-white'}
                                        `}
                                    >
                                        {tab.image ? (
                                            <img src={tab.image} alt={tab.label} className="w-5 h-5 object-contain" />
                                        ) : (
                                            Icon && <Icon size={20} />
                                        )}
                                        {tab.label}
                                        {tab.id === 'orders' && newOrderCount > 0 && (
                                            <span className="ml-auto text-xs font-bold bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                                                {newOrderCount}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </nav>

                        {/* Product Categories in Sidebar */}
                        {activeTab === 'products' && (
                            <div className="px-3 py-3 border-t border-white/10">
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 mb-2">Categories</p>
                                <div className="space-y-0.5 max-h-[40vh] overflow-y-auto">
                                    <button
                                        onClick={() => { setSelectedCategory(''); setSidebarOpen(false) }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${!selectedCategory
                                            ? 'bg-white/15 text-white'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        All Products
                                    </button>
                                    {productCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => { setSelectedCategory(cat); setSidebarOpen(false) }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === cat
                                                ? 'bg-white/15 text-white'
                                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-4 border-t border-white/10 mt-auto">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
                            >
                                <Power size={16} />
                                Logout
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* ─── Main Content ─── */}
            <div className="flex-1 lg:ml-64">
                {/* Top Bar */}
                <header className="bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between sticky top-0 z-40 shadow-sm border-b border-gray-100">
                    {/* Left Section */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <Menu size={22} className="text-gray-700" />
                        </button>

                        <div>
                            <h1 className="text-lg font-extrabold text-primary-dark tracking-tight">
                                <span className="lg:hidden">MRN MULLA</span>
                                <span className="hidden lg:inline">
                                    {TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
                                </span>
                            </h1>
                            <div className="flex items-center gap-1.5 lg:hidden">
                                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                                <span className="text-[10px] text-gray-400 font-medium">{isOnline ? 'Live' : 'Offline'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center gap-2">
                        {/* Notification */}
                        {newOrderCount > 0 && (
                            <button
                                onClick={() => {
                                    setActiveTab('orders')
                                    setNewOrderCount(0)
                                    setShowNotif(false)
                                }}
                                className="relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Bell size={20} className="text-gray-600" />
                                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                                    {newOrderCount}
                                </span>
                            </button>
                        )}

                        {/* Shop Toggle */}
                        <button
                            onClick={toggleShopStatus}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${shopOpen
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                }`}
                            title={shopOpen ? 'Shop is OPEN — click to close' : 'CLOSED — click to open'}
                        >
                            <Store size={14} />
                            {shopOpen ? 'Open' : 'Closed'}
                        </button>

                        {/* Refresh */}
                        <button
                            onClick={handleRefresh}
                            className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw size={20} className="text-gray-600" />
                        </button>
                    </div>
                </header>

                {/* ─── Mobile Tab Navigation ─── */}
                <nav className="lg:hidden flex bg-white border-b sticky top-[57px] z-30 shadow-sm">
                    {BOTTOM_TABS.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all
                                    flex flex-col items-center gap-1
                                    ${activeTab === tab.id
                                        ? 'border-b-3 border-primary-dark text-primary-dark bg-green-50/50'
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                    }
                                `}
                            >
                                {tab.image ? (
                                    <img src={tab.image} alt={tab.label} className="w-[18px] h-[18px] object-contain" />
                                ) : (
                                    Icon && <Icon size={18} />
                                )}
                                {tab.label}
                            </button>
                        )
                    })}
                </nav>

                {/* ─── Tab Content ─── */}
                <main className="p-2.5 sm:p-4 max-w-[1400px] mx-auto w-full" key={refreshKey}>
                    {activeTab === 'orders' && <OrdersTab />}
                    {activeTab === 'print' && <PrintRequestsTab />}
                    {activeTab === 'products' && <ProductsTab selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />}
                    {activeTab === 'bundles' && <BundlesTab />}
                    {activeTab === 'reports' && <ReportsTab />}
                    {activeTab === 'voice' && <AITab />}
                    {activeTab === 'settings' && <SettingsTab />}
                </main>
            </div>
        </div>
    )
}