import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Volume2, Send, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
// Using the stable Gemini 1.5 Flash endpoint which is lightning fast for function calling
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=AIzaSyBdJC95c5cKGQeTqThAY9XUO8o-i9Viufg`

const EXAMPLE_COMMANDS = [
    { text: 'What is the price of Sugar?', icon: '🏷️', category: 'Query' },
    { text: 'Update Toor Dal price to 95', icon: '💰', category: 'Price' },
    { text: 'Check stock of Rice', icon: '🔍', category: 'Query' },
    { text: 'Add 10kg Basmati for 1200 in Staples', icon: '📦', category: 'Product' },
    { text: 'Show me the last 5 orders', icon: '🛒', category: 'Orders' },
    { text: 'Show low stock items', icon: '⚠️', category: 'Report' },
]

export default function AITab() {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [response, setResponse] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [textInput, setTextInput] = useState('')
    const transcriptRef = useRef('')

    useEffect(() => {
        SpeechRecognition.requestPermissions().catch(() => { })
        return () => {
            SpeechRecognition.stop().catch(() => { })
        }
    }, [])

    // ─── Call Gemini API with Function Calling (Tools) ───
    const callGemini = async (command, productList, retries = 2) => {
        const systemPrompt = `You are Jarvis, the voice AI assistant for KGN Sales (MRN Mulla Kirana).
        Your job is to listen to the admin and trigger the correct function. 
        Here is the current product list to help you match names accurately:
        ${productList}`

        // These are your "Jarvis Skills"
        const tools = [{
            functionDeclarations: [
                {
                    name: "get_product_price",
                    description: "Find out the current price of a specific product without changing it.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            product_name: { type: "STRING", description: "The exact name of the product" }
                        },
                        required: ["product_name"]
                    }
                },
                {
                    name: "update_product_price",
                    description: "Update or change the price of an existing product in the database.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            product_name: { type: "STRING", description: "The exact name of the product" },
                            new_price: { type: "NUMBER", description: "The new price in rupees" }
                        },
                        required: ["product_name", "new_price"]
                    }
                },
                {
                    name: "add_new_product",
                    description: "Add a brand new product to the store inventory.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING" },
                            price: { type: "NUMBER" },
                            category: { type: "STRING" },
                            stock_quantity: { type: "NUMBER" }
                        },
                        required: ["name", "price", "category", "stock_quantity"]
                    }
                },
                {
                    name: "check_stock_level",
                    description: "Check how much inventory/stock is left for a specific product.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            product_name: { type: "STRING" }
                        },
                        required: ["product_name"]
                    }
                },
                {
                    name: "get_recent_orders",
                    description: "Fetch the most recent orders placed by customers.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            limit: { type: "NUMBER", description: "How many orders to show (default 5)" }
                        }
                    }
                },
                {
                    name: "update_order_status",
                    description: "Update the delivery or completion status of an order.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            order_id: { type: "STRING" },
                            new_status: { type: "STRING", description: "e.g., Pending, Out for Delivery, Completed" }
                        },
                        required: ["order_id", "new_status"]
                    }
                },
                {
                    name: "get_low_stock",
                    description: "Find all products that have low inventory.",
                    parameters: { type: "OBJECT", properties: {} }
                }
            ]
        }]

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

                const res = await fetch(GEMINI_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ parts: [{ text: command }] }],
                        tools: tools,
                        generationConfig: { temperature: 0.1 }
                    })
                })

                if (!res.ok) throw new Error('Gemini API request failed')

                const data = await res.json()
                const part = data?.candidates?.[0]?.content?.parts?.[0]

                // If Gemini decides to call a function, return the function details
                if (part?.functionCall) {
                    return {
                        isFunction: true,
                        name: part.functionCall.name,
                        args: part.functionCall.args || {}
                    }
                }

                // If it just wants to talk normally
                if (part?.text) {
                    return { isFunction: false, text: part.text }
                }

                throw new Error('Empty response from Gemini')

            } catch (err) {
                if (attempt === retries) throw err
                await new Promise(r => setTimeout(r, 1000))
            }
        }
    }

    const speakText = async (text) => {
        const cleanText = text.replace(/[✅📦📊⚠️🤖❌🔍💰🏷️•\n\*\_]/g, ' ').replace(/\s+/g, ' ').trim()
        try {
            await TextToSpeech.speak({
                text: cleanText, lang: 'en-IN', rate: 0.9, pitch: 1.0, volume: 1.0, category: 'ambient',
            })
        } catch (err) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel()
                const utterance = new SpeechSynthesisUtterance(cleanText)
                utterance.lang = 'en-IN'
                utterance.rate = 0.9
                window.speechSynthesis.speak(utterance)
            }
        }
    }

    // ─── Process command and execute Supabase actions ───
    const processCommand = useCallback(async (command) => {
        setIsProcessing(true)
        let reply = ''

        try {
            const { data: products } = await supabase.from('products').select('name, price, stock, category').order('name')
            const productList = products?.map(p => `- ${p.name} [${p.category}] - ₹${p.price} (${p.stock || 0} left)`).join('\n') || ''

            const action = await callGemini(command, productList)

            if (!action.isFunction) {
                reply = action.text
            } else {
                console.log('Jarvis is executing:', action.name, action.args)

                // THE EXECUTION LAYER (The Hands)
                switch (action.name) {

                    case 'get_product_price': {
                        const { product_name } = action.args
                        const { data, error } = await supabase
                            .from('products').select('name, price').ilike('name', `%${product_name}%`).limit(1)
                        if (error) throw error
                        if (data?.length > 0) {
                            reply = `🏷️ The current price of ${data[0].name} is ₹${data[0].price}.`
                        } else {
                            reply = `❌ I couldn't find the price for ${product_name} in the store.`
                        }
                        break
                    }

                    case 'update_product_price': {
                        const { product_name, new_price } = action.args
                        const { data, error } = await supabase
                            .from('products')
                            .update({ price: new_price })
                            .ilike('name', `%${product_name}%`)
                            .select()
                        if (error) throw error
                        if (data?.length > 0) {
                            reply = `✅ I have updated the price of ${data[0].name} to ₹${new_price}.`
                        } else {
                            reply = `❌ I couldn't find ${product_name} to update.`
                        }
                        break
                    }

                    case 'add_new_product': {
                        const { name, price, category, stock_quantity } = action.args
                        const { error } = await supabase
                            .from('products')
                            .insert([{ name, price, category, stock: stock_quantity }])
                        if (error) throw error
                        reply = `📦 Added ${name} to the ${category} category with a price of ₹${price}.`
                        break
                    }

                    case 'check_stock_level': {
                        const { product_name } = action.args
                        const { data, error } = await supabase
                            .from('products').select('name, stock').ilike('name', `%${product_name}%`).limit(1)
                        if (error) throw error
                        if (data?.length > 0) {
                            reply = `🔍 You have ${data[0].stock || 0} units of ${data[0].name} left in stock.`
                        } else {
                            reply = `❌ I couldn't find any stock information for ${product_name}.`
                        }
                        break
                    }

                    case 'get_recent_orders': {
                        const limit = action.args.limit || 5
                        const { data, error } = await supabase
                            .from('orders').select('id, total_amount, status').order('created_at', { ascending: false }).limit(limit)
                        if (error) throw error
                        if (data?.length > 0) {
                            const orderList = data.map(o => `Order ${o.id}: ₹${o.total_amount} (${o.status})`).join('\n')
                            reply = `🛒 Here are the last ${data.length} orders:\n${orderList}`
                        } else {
                            reply = `There are no recent orders.`
                        }
                        break
                    }

                    case 'update_order_status': {
                        const { order_id, new_status } = action.args
                        const { data, error } = await supabase
                            .from('orders').update({ status: new_status }).eq('id', order_id).select()
                        if (error) throw error
                        if (data?.length > 0) {
                            reply = `✅ Order ${order_id} has been marked as ${new_status}.`
                        } else {
                            reply = `❌ I couldn't find Order ${order_id}.`
                        }
                        break
                    }

                    case 'get_low_stock': {
                        const { data, error } = await supabase
                            .from('products').select('name, stock').lt('stock', 10).order('stock')
                        if (error) throw error
                        if (data?.length > 0) {
                            const items = data.map(p => `• ${p.name}: ${p.stock || 0} left`).join('\n')
                            reply = `⚠️ Here are the low stock items:\n${items}`
                        } else {
                            reply = '✅ All products are well-stocked!'
                        }
                        break
                    }

                    default:
                        reply = `I'm sorry, I don't know how to execute the command: ${action.name}`
                }
            }

        } catch (err) {
            console.error('Jarvis Error:', err)
            reply = `⚠️ Error: ${err.message}. Please try again.`
        }

        setResponse(reply)
        setIsProcessing(false)
        speakText(reply)
    }, [])

    // ─── Voice Recording Submission Logic ───
    const submitVoiceCommand = useCallback(() => {
        setIsListening(false);
        const finalSpokenText = transcriptRef.current;

        if (finalSpokenText && finalSpokenText.trim()) {
            processCommand(finalSpokenText.trim());
            transcriptRef.current = '';
        } else {
            setTranscript('');
        }
    }, [processCommand]);

    const startListening = useCallback(async () => {
        try {
            const { available } = await SpeechRecognition.available()
            if (!available) throw new Error('Not available natively')

            const { speechRecognition } = await SpeechRecognition.checkPermissions()
            if (speechRecognition !== 'granted') {
                const perm = await SpeechRecognition.requestPermissions()
                if (perm.speechRecognition !== 'granted') return toast.error('Microphone permission denied')
            }

            setIsListening(true)
            setTranscript('')
            transcriptRef.current = ''

            SpeechRecognition.addListener('partialResults', (data) => {
                if (data.matches && data.matches.length > 0) {
                    setTranscript(data.matches[0])
                    transcriptRef.current = data.matches[0]
                }
            })

            const result = await SpeechRecognition.start({
                language: 'en-IN',
                maxResults: 1,
                partialResults: true,
                popup: false
            });

            if (result && result.matches && result.matches.length > 0) {
                transcriptRef.current = result.matches[0];
                setTranscript(result.matches[0]);
            }

            submitVoiceCommand();

        } catch (err) {
            console.error('Speech recognition error:', err)
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                startWebSpeech()
            } else {
                setIsListening(false)
                toast.error('Speech recognition not available.')
            }
        }
    }, [submitVoiceCommand]) // removed startWebSpeech from dependency to avoid circular reference

    const startWebSpeech = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SR) return
        const recognition = new SR()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-IN'

        recognition.onstart = () => { setIsListening(true); setTranscript(''); transcriptRef.current = ''; }

        recognition.onresult = (event) => {
            const result = Array.from(event.results).map(r => r[0].transcript).join('')
            setTranscript(result)
            transcriptRef.current = result
        }

        recognition.onend = () => {
            submitVoiceCommand();
        }

        recognition.onerror = () => {
            setIsListening(false)
        }

        recognition.start()
    }, [submitVoiceCommand])

    const stopListening = useCallback(async () => {
        try { await SpeechRecognition.stop() } catch { }
        submitVoiceCommand();
    }, [submitVoiceCommand])

    const handleTextCommand = () => {
        if (!textInput.trim()) return
        const cmd = textInput.trim()
        setTranscript(cmd)
        processCommand(cmd)
        setTextInput('')
    }

    return (
        <div className="max-w-xl mx-auto pb-20">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-linear-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/30 rounded-full px-4 py-1.5 mb-3">
                    <Sparkles size={14} className="text-purple-500" />
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">KGN Sales AI</span>
                </div>
                <h2 className="text-xl font-extrabold text-gray-900">Jarvis Assistant</h2>
                <p className="text-sm text-gray-400 mt-1">Manage your store with voice or text commands</p>
            </div>

            {/* Voice Button */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessing}
                    className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300
                        ${isListening ? 'bg-linear-to-br from-red-500 to-red-600 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-110'
                            : 'bg-linear-to-br from-primary-dark to-primary-medium shadow-[0_8px_32px_rgba(2,52,48,0.3)] hover:scale-105'
                        } disabled:opacity-50 active:scale-95`}
                >
                    {isListening && (
                        <>
                            <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping" />
                            <div className="absolute inset-[-8px] rounded-full border border-red-400/30 animate-pulse" />
                        </>
                    )}
                    {isListening ? <MicOff size={36} className="text-white relative z-10" /> : <Mic size={36} className="text-white relative z-10" />}
                </button>
            </div>

            <p className="text-center text-xs text-gray-400 mb-6 font-medium">
                {isListening ? '🎙️ Listening... Speak now' : isProcessing ? '🔄 Processing with Jarvis...' : 'Tap the mic or type a command below'}
            </p>

            {/* Text Input */}
            <div className="flex gap-2 mb-6 px-1">
                <input
                    type="text"
                    placeholder="Type a command..."
                    className="input-field flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary-dark"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTextCommand()}
                />
                <button onClick={handleTextCommand} disabled={!textInput.trim() || isProcessing} className="px-4 py-3 rounded-xl bg-primary-dark text-white font-semibold disabled:opacity-30 active:scale-95 transition-all shadow-sm">
                    <Send size={18} />
                </button>
            </div>

            {/* Transcript & Response area */}
            {transcript && (
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 mx-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">You said:</p>
                    <p className="text-base font-semibold text-gray-800">"{transcript}"</p>
                </div>
            )}

            {isProcessing && (
                <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 mx-1 shadow-sm flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                </div>
            )}

            {response && !isProcessing && (
                <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 mx-1 shadow-sm animate-fadeIn">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Jarvis</p>
                            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-line">{response}</p>
                        </div>
                    </div>
                    <button onClick={() => speakText(response)} className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-11">
                        <Volume2 size={14} /> Play Again
                    </button>
                </div>
            )}

            {!transcript && !response && (
                <div className="mx-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Try these commands</p>
                    <div className="space-y-2">
                        {EXAMPLE_COMMANDS.map((cmd, i) => (
                            <button key={i} onClick={() => { setTranscript(cmd.text); processCommand(cmd.text) }} className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 text-left hover:bg-gray-50 transition-colors border border-gray-100 shadow-sm group">
                                <span className="text-xl">{cmd.icon}</span>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-800 group-hover:text-primary-dark transition-colors">{cmd.text}</p>
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