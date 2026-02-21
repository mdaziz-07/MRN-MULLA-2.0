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

    // Android hardware back button: navigate home instead of closing app
    useEffect(() => {
        if (APP_MODE !== 'customer') return
        let cleanup
        import('@capacitor/app').then(({ App: CapApp }) => {
            CapApp.addListener('backButton', ({ canGoBack }) => {
                if (window.location.pathname !== '/') {
                    window.location.href = '/'
                } else {
                    CapApp.minimizeApp()
                }
            })
            cleanup = () => CapApp.removeAllListeners()
        }).catch(() => { })
        return () => cleanup?.()
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
            {/* Customer onboarding: shown once on first launch */}
            {showOnboarding && (
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