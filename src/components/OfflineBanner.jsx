import { useState, useEffect } from 'react'
import { WifiOff, RefreshCcw } from 'lucide-react'

export default function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    if (isOnline) return null

    return (
        <div className="fixed inset-0 z-10000 bg-primary-dark flex flex-col items-center justify-center p-6 animate-fadeIn">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <WifiOff size={48} className="text-red-500" />
                </div>

                <h2 className="text-2xl font-black text-gray-900 mb-3">No Internet Connection</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">
                    Please turn on Mobile Data or Wi-Fi to continue using the app.
                </p>

                <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-primary-dark text-white py-4 rounded-xl font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    <RefreshCcw size={20} />
                    Try Again
                </button>
            </div>
        </div>
    )
}
