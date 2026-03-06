import { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'

export default function ProductModal({ product, onClose, isInCart, qty, onAdd, onIncrement, onDecrement }) {
    // Parse images (handle comma-separated string or array)
    const images = Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : product.image_url
            ? product.image_url.split(',').map(u => u.trim()).filter(Boolean)
            : []

    const [activeImage, setActiveImage] = useState(0)

    // Reset active image when product changes
    useEffect(() => { setActiveImage(0) }, [product])

    const nextImage = (e) => {
        e.stopPropagation()
        setActiveImage(prev => (prev + 1) % images.length)
    }

    const prevImage = (e) => {
        e.stopPropagation()
        setActiveImage(prev => (prev - 1 + images.length) % images.length)
    }

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    const discount = product.mrp && product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 0

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl animate-slideUp sm:animate-scaleIn max-h-[85vh] flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md text-gray-600 p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Image Section */}
                <div className="relative bg-linear-to-b from-gray-50 to-white flex items-center justify-center shrink-0 w-full"
                    style={{ minHeight: '300px' }}
                >
                    {images.length > 0 ? (
                        <>
                            <img
                                src={images[activeImage]}
                                alt={product.name}
                                className="max-h-[280px] w-full object-contain p-6 mix-blend-multiply transition-opacity duration-300"
                                onError={(e) => {
                                    e.target.onerror = null
                                    e.target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect fill='%23f5f5f5' width='200' height='200'/><text x='100' y='110' text-anchor='middle' fill='%23999' font-size='24'>${encodeURIComponent(product.name.charAt(0))}</text></svg>`
                                }}
                            />

                            {/* Carousel Controls */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow-md text-gray-700 hover:bg-white"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center">❮</div>
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow-md text-gray-700 hover:bg-white"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center">❯</div>
                                    </button>

                                    {/* Dots */}
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                                        {images.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeImage ? 'bg-primary-dark w-3' : 'bg-gray-300'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-7xl font-light">
                            {product.name.charAt(0)}
                        </div>
                    )}

                    {/* Discount Badge */}
                    {discount > 0 && (
                        <div className="absolute top-4 left-4 bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm z-10">
                            {discount}% OFF
                        </div>
                    )}
                </div>

                {/* Product Details */}
                <div className="p-5 overflow-y-auto">
                    {/* Name & Category */}
                    <div className="flex items-start justify-between gap-3 mb-1">
                        <h2 className="text-xl font-extrabold text-gray-900 leading-tight">
                            {product.name}
                        </h2>
                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border border-emerald-200 shrink-0">
                            {product.category}
                        </span>
                    </div>

                    <p className="text-gray-400 font-semibold text-sm mb-4">
                        {product.pack_size} {product.unit}
                    </p>

                    {/* Divider */}
                    <div className="h-px bg-gray-100 mb-4" />

                    {/* Price & Cart Action */}
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-3xl font-black text-primary-dark">₹{product.price}</span>
                            {product.mrp && product.mrp > product.price && (
                                <span className="text-base text-gray-300 line-through ml-2 font-medium">₹{product.mrp}</span>
                            )}
                        </div>

                        <div className="min-w-[140px]">
                            {!isInCart ? (
                                <button
                                    onClick={() => onAdd(product)}
                                    className="w-full bg-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg hover:bg-[#034d45] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Add to Cart
                                </button>
                            ) : (
                                <div className="flex items-center justify-between bg-gray-50 rounded-2xl h-14 px-3 border border-gray-200">
                                    <button
                                        onClick={() => onDecrement(product.id)}
                                        className="w-9 h-9 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className="text-xl font-black text-gray-900 min-w-[30px] text-center">{qty}</span>
                                    <button
                                        onClick={() => onIncrement(product.id)}
                                        className="w-9 h-9 flex items-center justify-center bg-primary-dark text-white rounded-full shadow-sm hover:bg-[#034d45] transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
