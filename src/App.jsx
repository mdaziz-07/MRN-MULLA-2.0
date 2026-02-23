import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { Toaster, toast } from 'sonner'
import { lazy, Suspense, useEffect, useState } from 'react'
import CustomerOnboarding from './components/CustomerOnboarding'

// --- NEW IMPORTS FOR PUSH NOTIFICATIONS ---
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { supabase } from './lib/supabase'

// App Mode: 'customer' or 'admin'
const APP_MODE = import.meta.env.VITE_APP_MODE || 'customer'

// Current build version of the Customer App. Increase when publishing new APKs.
const APP_BUILD_VERSION = 1

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home'))
const Checkout = lazy(() => import('./pages/Checkout'))
const TrackOrder = lazy(() => import('./pages/TrackOrder'))
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))
const PrintUpload = lazy(() => import('./pages/PrintUpload'))

function LoadingScreen() {
    return (
        <div className="min-h-screen bg-[#023430] flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/70 text-sm font-medium">Loading...</p>
            </div>
        </div>
    )
}

function App() {
    // For customer mode: show onboarding if no saved data
    const [showOnboarding, setShowOnboarding] = useState(() => {
        if (APP_MODE !== 'customer') return false
        try {
            return !localStorage.getItem('mrn_customer_data')
        } catch { return false }
    })

    const [updateRequired, setUpdateRequired] = useState(false)

    // Check for App Update (Customer Only)
    useEffect(() => {
        if (APP_MODE !== 'customer' || !Capacitor.isNativePlatform()) return

        const checkVersion = async () => {
            try {
                const { data } = await supabase
                    .from('store_settings')
                    .select('value')
                    .eq('key', 'latest_app_version')
                    .single()

                if (data && data.value) {
                    const latestVersion = parseInt(data.value, 10)
                    if (latestVersion > APP_BUILD_VERSION) {
                        setUpdateRequired(true)
                    }
                }
            } catch (err) {
                console.error("Failed to check app version:", err)
            }
        }

        checkVersion()
    }, [])

    // Android hardware back button: navigate home instead of closing app
    useEffect(() => {
        let cleanupBack
        let cleanupState
        import('@capacitor/app').then(({ App: CapApp }) => {
            if (APP_MODE === 'customer') {
                CapApp.addListener('backButton', ({ canGoBack }) => {
                    if (window.location.pathname !== '/') {
                        window.location.href = '/'
                    } else {
                        CapApp.minimizeApp()
                    }
                })
            }

            // Realtime Connection Fix for Mobile (Both Admin and Customer apps when resuming from background)
            if (Capacitor.isNativePlatform()) {
                CapApp.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) {
                        console.log('App returned to Foreground. Refreshing realtime connection...')
                        // Invalidate and reestablish realtime connections when waking up
                        supabase.removeAllChannels()
                        // Instead of a manual reconnect method we simulate an automatic reconnect by dispatching a custom event 
                        // that Home.jsx and Admin App components can respond to if they want to rebuild their channels
                        window.dispatchEvent(new Event('appResumed'))
                    }
                })
            }

            cleanupBack = () => CapApp.removeAllListeners()
        }).catch(() => { })
        return () => cleanupBack?.()
    }, [])

    // --- PUSH NOTIFICATION LOGIC (ADMIN ONLY) ---
    useEffect(() => {
        // Only run on Native devices AND only if it's the Admin App
        if (APP_MODE === 'admin' && Capacitor.isNativePlatform()) {
            initNotifications()
        }
    }, [])

    const initNotifications = async () => {
        try {
            // 1. Create the 'orders' channel for Android (High Priority)
            if (Capacitor.getPlatform() === 'android') {
                await PushNotifications.createChannel({
                    id: 'orders_loud',
                    name: 'New Orders',
                    description: 'Loud alerts for incoming orders',
                    importance: 5, // Max importance for loud sound + banner
                    visibility: 1, // Show on lock screen
                    sound: 'loud_alarm.wav',
                    vibration: true,
                })
            }

            // 2. Request permissions
            let permStatus = await PushNotifications.checkPermissions()
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions()
            }

            if (permStatus.receive !== 'granted') return

            // 3. Register with Google and get Token
            await PushNotifications.register()

            PushNotifications.addListener('registration', async (token) => {
                console.log('FCM Token:', token.value)
                const { error } = await supabase
                    .from('admin_devices')
                    .upsert({ fcm_token: token.value }, { onConflict: 'fcm_token' })

                if (error) console.error('Token save error:', error)
            })

            // 4. Foreground listener (Shows toast when app is open)
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                toast.success(`${notification.title}\n${notification.body}`, {
                    duration: 5000,
                    position: 'top-center'
                })
            })

            // 5. Action listener (When notification is tapped)
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('Notification tapped', action)
                // You can add routing logic here if needed later
            })

        } catch (err) {
            console.error('Push Init Error:', err)
        }
    }
    // --- END PUSH NOTIFICATION LOGIC ---

    return (
        <CartProvider>
            {/* Mandatory Update Screen */}
            {updateRequired && (
                <div className="fixed inset-0 z-[9999] bg-[#023430] flex flex-col justify-center items-center p-6 text-center animate-fadeIn">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl">🚀</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Update Required</h2>
                        <p className="text-base text-gray-600 mb-8 leading-relaxed">
                            This version of MRN Mulla Kirana is no longer supported. Please update to receive the latest features and bug fixes!
                        </p>
                        <a
                            onClick={async (e) => {
                                e.preventDefault()
                                const url = "https://www.dropbox.com/scl/fi/f8vpxoz12jfztn6brf8zz/MRN-Mulla-Kirana.apk?rlkey=xut6avgeej9zh9rvxs5opuqfn&st=2aplj0te&dl=1"
                                if (Capacitor.isNativePlatform()) {
                                    const { Browser } = await import('@capacitor/browser')
                                    await Browser.open({ url })
                                } else {
                                    window.open(url, '_blank')
                                }
                            }}
                            href="#"
                            className="w-full bg-[#023430] text-white py-4 rounded-xl font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2"
                        >
                            Download Update Now
                        </a>
                    </div>
                </div>
            )}

            {/* Customer onboarding: shown once on first launch */}
            {!updateRequired && showOnboarding && (
                <CustomerOnboarding onComplete={() => setShowOnboarding(false)} />
            )}
            <Router>
                <Toaster
                    position="top-center"
                    richColors
                    expand={false}
                    toastOptions={{
                        style: { marginTop: '3.5rem' },
                    }}
                />
                <Suspense fallback={<LoadingScreen />}>
                    {APP_MODE === 'admin' ? (
                        /* Admin APK: Only admin screens */
                        <Routes>
                            <Route path="*" element={<AdminApp />} />
                        </Routes>
                    ) : (
                        /* Customer APK: Only customer screens */
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/checkout" element={<Checkout />} />
                            <Route path="/orders" element={<TrackOrder />} />
                            <Route path="/track/:orderId" element={<TrackOrder />} />
                            <Route path="/print" element={<PrintUpload />} />
                        </Routes>
                    )}
                </Suspense>
            </Router>
        </CartProvider>
    )
}

export default App