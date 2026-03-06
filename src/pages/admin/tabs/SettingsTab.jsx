import { useState, useEffect, useMemo } from 'react'
import { Save, Truck, DollarSign, Printer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'

export default function SettingsTab() {
    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState({
        delivery_charge: '0',
        delivery_min_amount: '0',
        bw_price: '3',
        color_price: '10',
        latest_app_version: '1' // New setting for mandatory updates
    })
    const [savedSettings, setSavedSettings] = useState(null) // track original values

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('store_settings')
            .select('key, value')
            .in('key', ['delivery_charge', 'delivery_min_amount', 'bw_price', 'color_price', 'latest_app_version'])

        if (data) {
            const newSettings = { ...settings }
            data.forEach(item => {
                newSettings[item.key] = item.value
            })
            setSettings(newSettings)
            setSavedSettings({ ...newSettings })
        }
        setLoading(false)
    }

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    // Check if any settings have changed
    const hasChanges = useMemo(() => {
        if (!savedSettings) return false
        return Object.keys(settings).some(key => settings[key] !== savedSettings[key])
    }, [settings, savedSettings])

    const handleSave = async () => {
        setLoading(true)
        try {
            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value: String(value)
            }))

            const { error } = await supabase
                .from('store_settings')
                .upsert(updates, { onConflict: 'key' })

            if (error) throw error
            setSavedSettings({ ...settings })
            toast.success('Settings saved successfully!')
        } catch (err) {
            console.error(err)
            toast.error('Failed to save settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Delivery Settings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <Truck className="text-blue-600" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Delivery Settings</h2>
                        <p className="text-sm text-gray-500">Manage delivery charges and free delivery threshold</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Delivery Charge (₹)
                        </label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="number"
                                value={settings.delivery_charge}
                                onChange={(e) => handleChange('delivery_charge', e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all outline-none font-semibold"
                                placeholder="0"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Amount charged if order is below minimum. Set to 0 for free delivery always.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum Order for Free Delivery (₹)
                        </label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="number"
                                value={settings.delivery_min_amount}
                                onChange={(e) => handleChange('delivery_min_amount', e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all outline-none font-semibold"
                                placeholder="0"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Orders above this amount will have FREE delivery.
                        </p>
                    </div>
                </div>
            </div>

            {/* App Settings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                        <Save className="text-green-600" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">App Version Control</h2>
                        <p className="text-sm text-gray-500">Force customers to update their app</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Latest Customer App Version
                        </label>
                        <input
                            type="number"
                            value={settings.latest_app_version}
                            onChange={(e) => handleChange('latest_app_version', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all outline-none font-semibold"
                            placeholder="1"
                        />
                        <p className="text-xs text-red-500 mt-1">
                            ⚠️ If a customer's app version is lower than this number, they will be blocked from using the app and forced to download the new APK. Increment this when you release a new app update.
                        </p>
                    </div>
                </div>
            </div>

            {/* Print Pricing Settings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                        <Printer className="text-purple-600" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Print Pricing</h2>
                        <p className="text-sm text-gray-500">Set per-page pricing for B&W and Color prints</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            B&W Price per Page (₹)
                        </label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="number"
                                value={settings.bw_price}
                                onChange={(e) => handleChange('bw_price', e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all outline-none font-semibold"
                                placeholder="3"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Color Price per Page (₹)
                        </label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="number"
                                value={settings.color_price}
                                onChange={(e) => handleChange('color_price', e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-dark focus:border-transparent transition-all outline-none font-semibold"
                                placeholder="10"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button — colored only when changes exist */}
            <button
                onClick={handleSave}
                disabled={loading || !hasChanges}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${hasChanges
                    ? 'bg-primary-dark text-white hover:bg-[#034540] active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    } disabled:opacity-50`}
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <Save size={18} />
                        {hasChanges ? 'Save All Changes' : 'No Changes'}
                    </>
                )}
            </button>
        </div>
    )
}
