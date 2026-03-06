import { useState, useEffect } from 'react'
import { Upload, FileText, X, ArrowLeft, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useCart } from '../context/CartContext'

export default function PrintUpload() {
    const navigate = useNavigate()
    console.log('PrintUpload: Component Mounting...')

    const [files, setFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [printType, setPrintType] = useState('bw') // 'bw' or 'color'
    const [orientation, setOrientation] = useState('portrait') // 'portrait' or 'landscape'
    const [copies, setCopies] = useState(1)
    const [note, setNote] = useState('')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    // Safely get addToCart
    const { addToCart } = useCart()

    const [prices, setPrices] = useState({ bw: 3, color: 10 })

    // Safely get customer data
    const getCustomerData = () => {
        try {
            const saved = localStorage.getItem('mrn_customer_data')
            return saved ? JSON.parse(saved) : null
        } catch (e) {
            return null
        }
    }

    const savedCustomer = getCustomerData()
    const [customerName, setCustomerName] = useState(savedCustomer?.name || '')
    const [contact, setContact] = useState(savedCustomer?.phone || '')
    const isNewCustomer = !savedCustomer

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

    useEffect(() => {
        console.log('PrintUpload: Fetching prices...')
        // Fetch print prices
        const fetchPrices = async () => {
            try {
                const { data, error } = await supabase
                    .from('store_settings')
                    .select('key, value')
                    .in('key', ['bw_price', 'color_price'])

                if (error) throw error

                if (data) {
                    const newPrices = { ...prices }
                    data.forEach(p => {
                        if (p.key === 'bw_price') newPrices.bw = Number(p.value)
                        if (p.key === 'color_price') newPrices.color = Number(p.value)
                    })
                    setPrices(newPrices)
                    console.log('PrintUpload: Prices loaded', newPrices)
                }
            } catch (err) {
                console.error('PrintUpload: Error fetching prices', err)
            }
        }
        fetchPrices()
    }, [])

    const handleFileChange = (e) => {
        if (!e.target.files) return
        const newFiles = Array.from(e.target.files)
        const oversized = newFiles.filter(f => f.size > MAX_FILE_SIZE)
        if (oversized.length > 0) {
            toast.error(`File "${oversized[0].name}" exceeds 10MB limit`)
            return
        }
        setFiles(prev => [...prev, ...newFiles])
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const processFiles = async () => {
        if (files.length === 0) {
            toast.error('Please select at least one file')
            return null
        }
        if (!customerName.trim() || !/^\d{10}$/.test(contact)) {
            toast.error('Please enter your name and 10-digit mobile number')
            return null
        }

        // Save customer data for future
        try {
            localStorage.setItem('mrn_customer_data', JSON.stringify({ name: customerName.trim(), phone: contact }))
        } catch (e) { }

        setUploading(true)
        setUploadProgress(0)
        try {
            const uploadedFiles = []
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                setCurrentFileIndex(i)
                const fileName = `${Date.now()}_${i}_${file.name.replace(/\s+/g, '_')}`

                const { error } = await supabase.storage
                    .from('print-docs')
                    .upload(fileName, file)

                if (error) throw new Error(error.message || 'File upload failed')

                const { data: publicUrlData } = supabase.storage
                    .from('print-docs')
                    .getPublicUrl(fileName)

                uploadedFiles.push({
                    name: file.name,
                    url: publicUrlData.publicUrl,
                    size: file.size,
                    type: file.type
                })

                setUploadProgress(Math.round(((i + 1) / files.length) * 100))
            }
            return uploadedFiles
        } catch (error) {
            toast.error(error.message || 'Failed to upload files. Try again.')
            setUploading(false)
            return null
        }
    }

    // Direct Order: submit straight to print_orders table (no cart)
    const handleDirectOrder = async () => {
        // Step 1: Validate before starting upload
        if (files.length === 0) {
            toast.error('Please select at least one file')
            return
        }
        if (!customerName.trim()) {
            toast.error('Please enter your name')
            return
        }
        if (!/^\d{10}$/.test(contact.trim())) {
            toast.error('Please enter a valid 10-digit mobile number')
            return
        }

        // Save customer data
        try {
            localStorage.setItem('mrn_customer_data', JSON.stringify({
                name: customerName.trim(), phone: contact.trim()
            }))
        } catch { }

        // Step 2: Upload files (reuse processFiles logic)
        const uploadedFiles = await processFiles()
        if (!uploadedFiles) {
            // processFiles handles error toasts
            return
        }

        setUploading(true) // Keep uploading true while inserting order

        // Step 3: Insert into print_orders table
        try {
            const orderPayload = {
                customer_name: customerName.trim(),
                customer_phone: contact.trim(),
                print_type: printType,
                orientation,
                copies,
                customer_note: note,
                files: uploadedFiles,
                status: 'pending',
            }

            const { error: insertError } = await supabase
                .from('print_orders')
                .insert([orderPayload])
                .select()

            if (insertError) {
                throw new Error(`Order save failed: ${insertError.message}`)
            }

            toast.success('✅ Print order placed! We\'ll contact you soon.')
            setFiles([])
            setNote('')
            setCopies(1)
            setUploadProgress(0)
            navigate('/')
        } catch (insertErr) {
            toast.error(insertErr.message || 'Failed to place order. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    // Add to Cart: upload files then add cart item
    const handleAddToCart = async () => {
        const uploadedFiles = await processFiles()
        if (!uploadedFiles) return

        try {
            const pricePerSet = files.length * (printType === 'color' ? prices.color : prices.bw)
            addToCart({
                id: `print-${Date.now()}`,
                name: `${printType === 'bw' ? 'B&W' : 'Color'} Print (${files.length} file${files.length > 1 ? 's' : ''})`,
                price: pricePerSet,
                qty: copies,
                type: 'print',
                image: 'https://cdn-icons-png.flaticon.com/512/3022/3022251.png',
                details: {
                    printType, orientation, files: uploadedFiles, note,
                    customerName: customerName.trim(), customerPhone: contact
                }
            })
            toast.success('Added to cart!')
            setFiles([])
            setNote('')
            setCopies(1)
            setUploadProgress(0)
            navigate('/checkout')
        } catch (err) {
            toast.error('Failed to add to cart.')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header with Safe Area Padding */}
            <div className="bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">Print & Xerox Service</h1>
            </div>

            <main className="p-4 max-w-lg mx-auto space-y-6">

                {/* Customer Info — shown inline for new customers */}
                {isNewCustomer ? (
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">📋 Your Details</p>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-orange-200 text-sm font-medium outline-none focus:border-orange-400"
                        />
                        <input
                            type="tel"
                            placeholder="Mobile number (10 digits)"
                            value={contact}
                            onChange={(e) => setContact(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full px-4 py-2.5 rounded-xl border border-orange-200 text-sm font-medium outline-none focus:border-orange-400"
                            inputMode="numeric"
                        />
                    </div>
                ) : (
                    <div className="bg-primary-dark/5 border border-primary-dark/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-dark text-white flex items-center justify-center text-sm font-bold">
                            {customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">{customerName}</p>
                            <p className="text-xs text-gray-500">📱 {contact}</p>
                        </div>
                    </div>
                )}

                {/* File Upload Area */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-dashed border-gray-300 text-center">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Upload size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Upload Documents</h3>
                    <p className="text-xs text-gray-500 mb-4">PDF, Images, Word docs supported (max 10MB)</p>

                    <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="inline-block px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-black transition-colors"
                    >
                        Select Files
                    </label>
                </div>

                {/* File List */}
                {files.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selected Files ({files.length})</p>
                        {files.map((file, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between border border-gray-100">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileText size={18} className="text-gray-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-sm font-medium text-gray-700 truncate block">{file.name}</span>
                                        <span className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                                    </div>
                                </div>
                                <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 p-1">
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload Progress Bar */}
                {uploading && (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-gray-500">Uploading file {currentFileIndex + 1} of {files.length}...</p>
                            <span className="text-xs font-bold text-primary-dark">{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-linear-to-r from-primary-dark to-primary-medium rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Options Form */}
                <div className="bg-white p-5 rounded-2xl shadow-sm space-y-5">

                    {/* Print Type */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Print Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPrintType('bw')}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${printType === 'bw'
                                    ? 'border-gray-900 bg-gray-50'
                                    : 'border-transparent bg-gray-50 text-gray-500'
                                    }`}
                            >
                                <span className="font-bold text-gray-900">B&W</span>
                                <span className="text-[10px]">Black & White</span>
                            </button>
                            <button
                                onClick={() => setPrintType('color')}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${printType === 'color'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-transparent bg-gray-50 text-gray-500'
                                    }`}
                            >
                                <span className={`font-bold ${printType === 'color' ? 'text-blue-600' : 'text-gray-900'}`}>Color</span>
                                <span className="text-[10px]">Full Color</span>
                            </button>
                        </div>
                    </div>

                    {/* Orientation */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Orientation</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOrientation('portrait')}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${orientation === 'portrait'
                                    ? 'border-primary-dark bg-green-50'
                                    : 'border-transparent bg-gray-50 text-gray-500'
                                    }`}
                            >
                                <div className={`w-6 h-8 border-2 rounded-sm mb-1 ${orientation === 'portrait' ? 'border-primary-dark' : 'border-gray-300'}`} />
                                <span className={`text-xs font-bold ${orientation === 'portrait' ? 'text-primary-dark' : 'text-gray-600'}`}>Portrait</span>
                            </button>
                            <button
                                onClick={() => setOrientation('landscape')}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${orientation === 'landscape'
                                    ? 'border-primary-dark bg-green-50'
                                    : 'border-transparent bg-gray-50 text-gray-500'
                                    }`}
                            >
                                <div className={`w-8 h-6 border-2 rounded-sm mb-1 ${orientation === 'landscape' ? 'border-primary-dark' : 'border-gray-300'}`} />
                                <span className={`text-xs font-bold ${orientation === 'landscape' ? 'text-primary-dark' : 'text-gray-600'}`}>Landscape</span>
                            </button>
                        </div>
                    </div>

                    {/* Number of Copies */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Number of Copies</label>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                                    className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    <span className="text-lg font-bold">−</span>
                                </button>
                                <input
                                    type="number"
                                    value={copies}
                                    onChange={(e) => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                    className="w-14 text-center text-lg font-bold border-x border-gray-200 py-2 outline-none"
                                    min={1}
                                    max={100}
                                />
                                <button
                                    onClick={() => setCopies(prev => Math.min(100, prev + 1))}
                                    className="w-10 h-10 flex items-center justify-center text-primary-dark hover:bg-gray-50 transition-colors"
                                >
                                    <span className="text-lg font-bold">+</span>
                                </button>
                            </div>
                            <span className="text-xs text-gray-400">Max 100 copies</span>
                        </div>
                    </div>

                    {/* Special Instructions */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Special Instructions (Optional)</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. double sided, staple pages..."
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-gray-200 transition-all resize-none h-24"
                        />
                    </div>
                </div>
            </main>

            {/* Bottom Bar — Two action buttons */}
            <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-white border-t border-gray-100 space-y-2">
                {/* Estimated Price */}
                {files.length > 0 && (
                    <p className="text-xs text-center text-gray-500 mb-1">
                        Estimate: ₹{files.length * copies * (printType === 'color' ? prices.color : prices.bw)} for {copies} {copies > 1 ? 'copies' : 'copy'}
                    </p>
                )}
                <div className="flex gap-2">
                    {/* Direct Order button */}
                    <button
                        onClick={handleDirectOrder}
                        disabled={uploading}
                        className="flex-1 bg-primary-dark text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#034540] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {uploading ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{uploadProgress}%</>
                        ) : (
                            <>🖨️ Order Now</>
                        )}
                    </button>
                    {/* Add to Cart button */}
                    <button
                        onClick={handleAddToCart}
                        disabled={uploading}
                        className="flex-1 border-2 border-primary-dark text-primary-dark py-3.5 rounded-xl font-bold text-sm hover:bg-primary-dark/5 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <ShoppingCart size={16} /> Add to Cart
                    </button>
                </div>
            </div>
        </div>
    )
}
