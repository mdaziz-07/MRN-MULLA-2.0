import { useState } from 'react'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

const ADMIN_PIN = '7860' // Change this to your actual PIN

export default function AdminLogin({ onLogin }) {
    const [pin, setPin] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [shake, setShake] = useState(false)

    const handleLogin = () => {
        if (pin === ADMIN_PIN) {
            onLogin()
            toast.success('Welcome, Admin!')
        } else {
            setShake(true)
            setTimeout(() => setShake(false), 500)
            toast.error('Incorrect PIN')
            setPin('')
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleLogin()
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#023430] via-[#034d45] to-[#023430]" />

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

            {/* Login Card */}
            <div className={`
                relative z-10 w-full max-w-sm mx-6
                bg-white/10 backdrop-blur-xl border border-white/20
                rounded-3xl p-8 shadow-2xl
                ${shake ? 'animate-shake' : ''}
            `}>
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/20">
                        <ShieldCheck size={40} className="text-white" />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        Admin Access
                    </h1>
                    <p className="text-white/50 text-sm mt-1 font-medium">
                        Enter your PIN to continue
                    </p>
                </div>

                {/* PIN Input */}
                <div className="mb-6">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">
                        Admin PIN
                    </label>
                    <div className="relative">
                        <input
                            type={showPin ? 'text' : 'password'}
                            placeholder="• • • •"
                            className="
                                w-full px-5 py-4 rounded-2xl
                                bg-white/10 border border-white/20
                                text-white text-lg tracking-[0.5em] text-center
                                placeholder-white/20
                                focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent
                                transition-all font-bold
                            "
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            maxLength={8}
                        />
                        <button
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                        >
                            {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                {/* Login Button */}
                <button
                    onClick={handleLogin}
                    disabled={!pin}
                    className="
                        w-full py-4 rounded-2xl font-bold text-base
                        bg-white text-[#023430]
                        disabled:opacity-30 disabled:cursor-not-allowed
                        active:scale-[0.97] transition-all
                        shadow-lg hover:shadow-xl
                    "
                >
                    Unlock Dashboard
                </button>

                {/* Footer */}
                <p className="text-center text-white/30 text-xs mt-6 font-medium">
                    MRN MULLA KIRANA
                </p>
            </div>
        </div>
    )
}
