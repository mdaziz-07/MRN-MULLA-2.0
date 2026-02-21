import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Volume2, Send, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyCGb0717T0mo_1C2ou1i108q88jVPfBMkU`

const EXAMPLE_COMMANDS = [
    { text: 'Update Toor Dal price to 95', icon: '💰', category: 'Price' },
    { text: 'Sugar price 45', icon: '💰', category: 'Price' },
    { text: 'Add 50 stock to Milk', icon: '📦', category: 'Stock' },
    { text: 'Check stock of Rice', icon: '🔍', category: 'Query' },
    { text: 'Show low stock items', icon: '⚠️', category: 'Report' },
    { text: 'How many orders today?', icon: '📊', category: 'Analytics' },
]

export default function AITab() {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [response, setResponse] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [textInput, setTextInput] = useState('')

    useEffect(() => {
        // Request permissions on mount
        SpeechRecognition.requestPermissions().catch(() => { })
        return () => {
            SpeechRecognition.stop().catch(() => { })
        }
    }, [])

    // ─── Call Gemini API with retry logic ───
    const callGemini = async (command, productList, retries = 2) => {
        const systemPrompt = `You are a voice AI assistant for a grocery store admin panel. Your job is to understand the admin's command and return a structured JSON response.

Available products in the store:
${productList}

Based on the admin's command, return a JSON response with one of these actions:
1. {"action": "update_price", "product_name": "exact product name from list", "new_price": number}
2. {"action": "add_stock", "product_name": "exact product name from list", "quantity": number}
3. {"action": "check_stock", "product_name": "exact product name from list"}
4. {"action": "low_stock"} - to show all low stock items
5. {"action": "orders_today"} - to show today's order count and revenue
6. {"action": "search_product", "query": "search term"}
7. {"action": "unknown", "message": "helpful suggestion"}

IMPORTANT RULES:
- Always match the product name to the CLOSEST product from the available list above
- If the user says "dal" match it to the best dal product (e.g., "Toor Dal 1kg")
- If the user says "sugar" match to the best sugar product (e.g., "Sugar 1kg")
- The user may speak in Hinglish (Hindi + English mix), like "sugar ka price 45 karo" means update sugar price to 45
- Return ONLY valid JSON, no other text
- For price commands, extract the numeric price value
- For stock commands, extract the numeric quantity`

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

                const res = await fetch(GEMINI_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: `${systemPrompt}\n\nAdmin's command: "${command}"` }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 200,
                            responseMimeType: 'application/json'
                        }
                    })
                })

                if (!res.ok) {
                    const errText = await res.text()
                    console.error(`Gemini API error (attempt ${attempt + 1}):`, errText)
                    if (attempt < retries) {
                        await new Promise(r => setTimeout(r, 1000))
                        continue
                    }
                    throw new Error('Gemini API request failed after retries')
                }

                const data = await res.json()
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                if (!text) throw new Error('Empty response from Gemini')

                try {
                    return JSON.parse(text)
                } catch {
                    const jsonMatch = text.match(/\{[\s\S]*\}/)
                    if (jsonMatch) return JSON.parse(jsonMatch[0])
                    throw new Error('Invalid JSON response from Gemini')
                }
            } catch (err) {
                if (attempt === retries) throw err
                await new Promise(r => setTimeout(r, 1000))
            }
        }
    }

    // ─── Process command using Gemini AI ───
    const processCommand = useCallback(async (command) => {
        setIsProcessing(true)
        let reply = ''

        try {
            // 1. Fetch all product names from Supabase
            const { data: products, error: prodErr } = await supabase
                .from('products')
                .select('name, price, stock')
                .order('name')

            if (prodErr) throw prodErr

            const productList = products?.map(p => `- ${p.name} (₹${p.price}, Stock: ${p.stock || 0})`).join('\n') || 'No products found'

            // 2. Send command + products to Gemini
            const action = await callGemini(command, productList)
            console.log('Gemini action:', action)

            // 3. Execute the action
            switch (action.action) {
                case 'update_price': {
                    const { product_name, new_price } = action
                    if (!product_name || !new_price || new_price <= 0) {
                        reply = '❌ Could not determine product or price. Try "Sugar price 45".'
                        break
                    }

                    const { data, error } = await supabase
                        .from('products')
                        .update({ price: new_price })
                        .ilike('name', `%${product_name}%`)
                        .select()

                    if (error) throw error
                    if (data && data.length > 0) {
                        reply = `✅ Updated "${data[0].name}" price to ₹${new_price}!`
                        toast.success(`Price updated: ${data[0].name} → ₹${new_price}`)
                    } else {
                        reply = `❌ Product "${product_name}" not found in database.`
                    }
                    break
                }

                case 'add_stock': {
                    const { product_name, quantity } = action
                    if (!product_name || !quantity || quantity <= 0) {
                        reply = '❌ Could not determine product or quantity. Try "Add 50 stock to Milk".'
                        break
                    }

                    const { data: existing, error: fetchErr } = await supabase
                        .from('products')
                        .select('id, name, stock')
                        .ilike('name', `%${product_name}%`)
                        .limit(1)

                    if (fetchErr) throw fetchErr
                    if (existing && existing.length > 0) {
                        const newStock = (existing[0].stock || 0) + quantity
                        const { error: updateErr } = await supabase
                            .from('products')
                            .update({ stock: newStock })
                            .eq('id', existing[0].id)

                        if (updateErr) throw updateErr
                        reply = `📦 Added ${quantity} stock to "${existing[0].name}". New stock: ${newStock} units.`
                        toast.success(`Stock updated: ${existing[0].name} → ${newStock}`)
                    } else {
                        reply = `❌ Product "${product_name}" not found.`
                    }
                    break
                }

                case 'check_stock': {
                    const { product_name } = action
                    const { data, error } = await supabase
                        .from('products')
                        .select('name, stock, price')
                        .ilike('name', `%${product_name}%`)
                        .limit(5)

                    if (error) throw error
                    if (data && data.length > 0) {
                        const items = data.map(p => `${p.name}: ${p.stock || 0} units (₹${p.price})`).join('\n')
                        reply = `🔍 Stock info:\n${items}`
                    } else {
                        reply = `❌ No products found matching "${product_name}".`
                    }
                    break
                }

                case 'low_stock': {
                    const { data, error } = await supabase
                        .from('products')
                        .select('name, stock')
                        .lt('stock', 10)
                        .order('stock', { ascending: true })
                        .limit(10)

                    if (error) throw error
                    if (data && data.length > 0) {
                        const items = data.map(p => `• ${p.name}: ${p.stock || 0} left`).join('\n')
                        reply = `⚠️ Low stock items:\n${items}`
                    } else {
                        reply = '✅ All products are well-stocked!'
                    }
                    break
                }

                case 'orders_today': {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)

                    const { data, error, count } = await supabase
                        .from('orders')
                        .select('*', { count: 'exact' })
                        .gte('created_at', today.toISOString())

                    if (error) throw error
                    const totalRevenue = data ? data.reduce((sum, o) => sum + (o.total_amount || 0), 0) : 0
                    reply = `📊 Today's orders: ${count || 0} orders\n💰 Total revenue: ₹${totalRevenue}`
                    break
                }

                case 'search_product': {
                    const { query } = action
                    const { data, error } = await supabase
                        .from('products')
                        .select('name, price, stock, category')
                        .ilike('name', `%${query}%`)
                        .limit(5)

                    if (error) throw error
                    if (data && data.length > 0) {
                        const items = data.map(p => `• ${p.name} — ₹${p.price} (${p.stock || 0} in stock)`).join('\n')
                        reply = `🔍 Found ${data.length} product(s):\n${items}`
                    } else {
                        reply = `❌ No products found matching "${query}".`
                    }
                    break
                }

                default:
                    reply = action.message || `🤖 I understood: "${command}"\n\nTry commands like:\n• "Update Sugar price to 45"\n• "Add 50 stock to Milk"\n• "Check stock of Rice"\n• "Show low stock items"\n• "How many orders today?"`
            }

        } catch (err) {
            console.error('Command error:', err)
            reply = `⚠️ Error: ${err.message || 'Something went wrong'}. Please try again.`
        }

        setResponse(reply)
        setIsProcessing(false)

        // Text-to-speech
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel()
            const cleanText = reply.replace(/[✅📦📊⚠️🤖❌🔍💰•\n]/g, ' ').replace(/\s+/g, ' ').trim()
            const utterance = new SpeechSynthesisUtterance(cleanText)
            utterance.lang = 'en-IN'
            utterance.rate = 0.9
            window.speechSynthesis.speak(utterance)
        }
    }, [])

    // ─── Start Listening using native speech recognition ───
    const startListening = useCallback(async () => {
        try {
            // Check if available
            const { available } = await SpeechRecognition.available()
            if (!available) {
                toast.error('Speech recognition not available on this device')
                return
            }

            // Check permissions
            const { speechRecognition } = await SpeechRecognition.checkPermissions()
            if (speechRecognition !== 'granted') {
                const perm = await SpeechRecognition.requestPermissions()
                if (perm.speechRecognition !== 'granted') {
                    toast.error('Microphone permission denied. Check Android settings.')
                    return
                }
            }

            setIsListening(true)
            setTranscript('')
            setResponse('')

            // Listen for partial results
            SpeechRecognition.addListener('partialResults', (data) => {
                if (data.matches && data.matches.length > 0) {
                    setTranscript(data.matches[0])
                }
            })

            await SpeechRecognition.start({
                language: 'en-IN',
                maxResults: 1,
                partialResults: true,
                popup: false,
            })

            // The plugin auto-stops after silence. Listen for the result
            // We need to poll or wait for the final result
            // Use a timeout to check final results
            const checkResult = async () => {
                try {
                    const { status } = await SpeechRecognition.isListening()
                    if (!status) {
                        setIsListening(false)
                        return
                    }
                    setTimeout(checkResult, 1000)
                } catch {
                    setIsListening(false)
                }
            }
            setTimeout(checkResult, 5000)

        } catch (err) {
            console.error('Speech recognition error:', err)
            setIsListening(false)

            // Fallback to Web Speech API
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                startWebSpeech()
            } else {
                toast.error('Speech recognition not available. Use text input instead.')
            }
        }
    }, [])

    // Fallback: Web Speech API (works in browser, not in APK WebView)
    const startWebSpeech = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SR) return

        const recognition = new SR()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-IN'

        let finalResult = ''

        recognition.onstart = () => {
            setIsListening(true)
            setTranscript('')
            setResponse('')
        }

        recognition.onresult = (event) => {
            const result = Array.from(event.results)
                .map(r => r[0].transcript)
                .join('')
            setTranscript(result)
            finalResult = result
        }

        recognition.onend = () => {
            setIsListening(false)
            if (finalResult && finalResult.trim()) {
                processCommand(finalResult)
            }
        }

        recognition.onerror = (event) => {
            setIsListening(false)
            if (event.error === 'no-speech') {
                toast.info('No speech detected. Try again.')
            } else if (event.error === 'not-allowed') {
                toast.error('Microphone denied. Check settings.')
            } else {
                toast.error(`Voice error: ${event.error}`)
            }
        }

        recognition.start()
    }, [processCommand])

    const stopListening = useCallback(async () => {
        setIsListening(false)
        try {
            await SpeechRecognition.stop()
        } catch { }

        // Process the transcript we have
        const currentTranscript = transcript
        // Small delay to capture final transcript update
        setTimeout(() => {
            // Use the latest transcript from the DOM
            const transcriptEl = document.querySelector('[data-transcript]')
            const finalText = transcriptEl?.textContent?.replace(/^"|"$/g, '') || currentTranscript
            if (finalText && finalText.trim()) {
                processCommand(finalText)
            }
        }, 300)
    }, [transcript, processCommand])

    const handleTextCommand = () => {
        if (!textInput.trim()) return
        const cmd = textInput.trim()
        setTranscript(cmd)
        processCommand(cmd)
        setTextInput('')
    }

    const handleExampleClick = (text) => {
        setTranscript(text)
        processCommand(text)
    }

    const speakResponse = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel()
            const cleanText = text.replace(/[✅📦📊⚠️🤖❌🔍💰•\n]/g, ' ').replace(/\s+/g, ' ').trim()
            const utterance = new SpeechSynthesisUtterance(cleanText)
            utterance.lang = 'en-IN'
            utterance.rate = 0.9
            window.speechSynthesis.speak(utterance)
        }
    }

    return (
        <div className="max-w-xl mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/30 rounded-full px-4 py-1.5 mb-3">
                    <Sparkles size={14} className="text-purple-500" />
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Gemini AI Powered</span>
                </div>
                <h2 className="text-xl font-extrabold text-gray-900">Voice Assistant</h2>
                <p className="text-sm text-gray-400 mt-1">Manage your store with voice or text commands</p>
            </div>

            {/* Voice Button */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessing}
                    className={`
                        relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300
                        ${isListening
                            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-110'
                            : 'bg-gradient-to-br from-[#023430] to-[#046759] shadow-[0_8px_32px_rgba(2,52,48,0.3)] hover:shadow-[0_8px_40px_rgba(2,52,48,0.4)] hover:scale-105'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed active:scale-95
                    `}
                >
                    {isListening && (
                        <>
                            <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping" />
                            <div className="absolute inset-[-8px] rounded-full border border-red-400/30 animate-pulse" />
                        </>
                    )}
                    {isListening ? (
                        <MicOff size={36} className="text-white relative z-10" />
                    ) : (
                        <Mic size={36} className="text-white relative z-10" />
                    )}
                </button>
            </div>

            <p className="text-center text-xs text-gray-400 mb-6 font-medium">
                {isListening ? '🎙️ Listening... Speak now' :
                    isProcessing ? '🔄 Processing with Gemini AI...' :
                        'Tap the mic or type a command below'}
            </p>

            {/* Text Input */}
            <div className="flex gap-2 mb-6 px-1">
                <input
                    type="text"
                    placeholder="Type a command..."
                    className="input-field flex-1"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTextCommand()}
                />
                <button
                    onClick={handleTextCommand}
                    disabled={!textInput.trim() || isProcessing}
                    className="px-4 py-3 rounded-xl bg-[#023430] text-white font-semibold disabled:opacity-30 active:scale-95 transition-all shadow-sm"
                >
                    <Send size={18} />
                </button>
            </div>

            {/* Transcript */}
            {transcript && (
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 mx-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">You said:</p>
                    <p className="text-base font-semibold text-gray-800" data-transcript>"{transcript}"</p>
                </div>
            )}

            {/* Processing */}
            {isProcessing && (
                <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 mx-1 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Response */}
            {response && !isProcessing && (
                <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 mx-1 shadow-sm animate-fadeIn">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Gemini AI</p>
                            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-line">{response}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => speakResponse(response)}
                        className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-11"
                    >
                        <Volume2 size={14} /> Play Again
                    </button>
                </div>
            )}

            {/* Example Commands */}
            {!transcript && !response && (
                <div className="mx-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Try these commands</p>
                    <div className="space-y-2">
                        {EXAMPLE_COMMANDS.map((cmd, i) => (
                            <button
                                key={i}
                                onClick={() => handleExampleClick(cmd.text)}
                                className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 text-left hover:bg-gray-50 transition-colors border border-gray-100 shadow-sm group"
                            >
                                <span className="text-xl">{cmd.icon}</span>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-800 group-hover:text-[#023430] transition-colors">{cmd.text}</p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{cmd.category}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
