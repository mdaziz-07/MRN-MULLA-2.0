import { useState } from 'react'
import { User, Phone, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

/**
 * CustomerOnboarding
 * Shown ONCE on first app launch if no customer data is saved.
 * Saves name + phone to localStorage as 'mrn_customer_data'.
 */
export default function CustomerOnboarding({ onComplete }) {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [error, setError] = useState('')

    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        const trimmedName = name.trim()
        const trimmedPhone = phone.trim()

        if (!trimmedName) {
            setError('Please enter your name')
            return
        }
        if (!/^\d{10}$/.test(trimmedPhone)) {
            setError('Please enter a valid 10-digit mobile number')
            return
        }

        setIsLoading(true)

        try {
            // Check if phone number exists in db
            const { data: existingCustomer, error: fetchError } = await supabase
                .from('customers')
                .select('name')
                .eq('phone', trimmedPhone)
                .single()

            if (existingCustomer) {
                // Phone exists, check if name matches
                if (existingCustomer.name.toLowerCase() === trimmedName.toLowerCase()) {
                    toast.success(`Welcome back, ${trimmedName}!`)
                } else {
                    setError(`This mobile number is already registered to a different name. Please use a different number.`)
                    setIsLoading(false)
                    return
                }
            } else if (fetchError?.code === 'PGRST116') {
                // Not found - Create new user
                const { error: insertError } = await supabase
                    .from('customers')
                    .insert([{ phone: trimmedPhone, name: trimmedName }])

                if (insertError) {
                    throw insertError
                }
                toast.success('Registration successful!')
            } else {
                throw fetchError
            }

            // Save to local storage
            const customerData = { name: trimmedName, phone: trimmedPhone }
            try {
                localStorage.setItem('mrn_customer_data', JSON.stringify(customerData))
            } catch (e) {
                console.error('Failed to save customer data:', e)
            }

            onComplete(customerData)
        } catch (err) {
            console.error('Database error during onboarding:', err)
            setError('Something went wrong. Please try again or check your connection.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-[#023430] flex flex-col items-center justify-center p-6">
            {/* Logo / Icon */}
            <div className="mb-8 text-center">
                <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                    <span className="text-4xl">🛒</span>
                </div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">MRN Mulla Kirana</h1>
                <p className="text-white/60 text-sm mt-1">Welcome! Let's get you set up</p>
            </div>

            {/* Form card */}
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Your Details</h2>
                <p className="text-gray-500 text-sm mb-5">We'll autofill this every time you order</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <User size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Your full name"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError('') }}
                            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-[#023430] focus:ring-1 focus:ring-[#023430]/30 transition-colors"
                            autoComplete="name"
                        />
                    </div>

                    {/* Phone */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <Phone size={18} />
                        </div>
                        <input
                            type="tel"
                            placeholder="10-digit mobile number"
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
                            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-[#023430] focus:ring-1 focus:ring-[#023430]/30 transition-colors"
                            inputMode="numeric"
                            maxLength={10}
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-xs font-medium">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#023430] text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>Start Shopping <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>
            </div>

            <p className="text-white/40 text-xs mt-6 text-center max-w-xs">
                Your details are saved only on this device and used only for orders
            </p>
        </div>
    )
}
