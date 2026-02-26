import { useState, useEffect, useRef } from 'react'
import { FileText, Phone, Check, X, Printer, ExternalLink, Image, Eye } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function PrintRequestsTab() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const isFirstLoadRef = useRef(true)

    useEffect(() => {
        fetchRequests()

        const subscription = supabase
            .channel('admin-print-requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'print_orders' }, () => {
                fetchRequests()
            })
            .subscribe()

        const interval = setInterval(fetchRequests, 3000)

        return () => {
            subscription.unsubscribe()
            clearInterval(interval)
        }
    }, [])

    const fetchRequests = async () => {
        // Only show spinner on first load; polling refreshes are silent
        if (isFirstLoadRef.current) {
            setLoading(true)
        }
        const { data } = await supabase
            .from('print_orders')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) setRequests(data)
        setLoading(false)
        isFirstLoadRef.current = false

        // Auto-cleanup: delete records + storage files older than 1 hour
        cleanupOldRequests()
    }

    const cleanupOldRequests = async () => {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

            // Find old records
            const { data: oldRecords } = await supabase
                .from('print_orders')
                .select('id, files')
                .lt('created_at', oneHourAgo)

            if (!oldRecords || oldRecords.length === 0) return

            // Extract storage file paths from URLs and delete them
            const filePaths = []
            oldRecords.forEach(record => {
                const files = record.files || []
                files.forEach(f => {
                    if (f.url) {
                        // Extract path after /object/public/print-docs/
                        const match = f.url.match(/\/object\/public\/print-docs\/(.+)/)
                        if (match) filePaths.push(match[1])
                    }
                })
            })

            if (filePaths.length > 0) {
                await supabase.storage.from('print-docs').remove(filePaths)
            }

            // Delete the DB records
            const ids = oldRecords.map(r => r.id)
            await supabase.from('print_orders').delete().in('id', ids)
        } catch (err) {
            // Silently fail — cleanup is best-effort
            console.warn('Auto-cleanup error:', err)
        }
    }

    const updateStatus = async (id, status) => {
        const updateData = { status }
        // Record delivery time so auto-delete can trigger after 1 hour
        if (status === 'completed') {
            updateData.delivered_at = new Date().toISOString()
        }

        const { error } = await supabase
            .from('print_orders')
            .update(updateData)
            .eq('id', id)

        if (error) {
            toast.error('Failed to update request')
        } else {
            toast.success(`Request marked as ${status}`)
            fetchRequests()
        }
    }

    // Open file using Capacitor Browser (native Android browser intent)
    const openFile = async (url) => {
        if (!url) {
            toast.error('File URL is missing — cannot open')
            return
        }
        try {
            const { Browser } = await import('@capacitor/browser')
            await Browser.open({ url, windowName: '_blank' })
        } catch {
            try {
                window.open(url, '_blank', 'noopener,noreferrer')
            } catch {
                toast.info(`File URL: ${url}`)
            }
        }
    }

    const isImage = (file) => {
        const imgTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
        const ext = file.name?.split('.').pop()?.toLowerCase() || ''
        return imgTypes.includes(ext) || file.type?.startsWith('image/')
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800'
            case 'accepted': return 'bg-purple-100 text-purple-800'
            case 'completed': return 'bg-green-100 text-green-800'
            case 'rejected': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <div className="space-y-3 pb-20">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Printer size={20} /> Print Requests
            </h2>

            {loading ? (
                <div className="text-center py-10">Loading...</div>
            ) : requests.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No print requests found</div>
            ) : (
                <div className="grid gap-3">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                            {/* Header — compact */}
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${getStatusColor(req.status)}`}>
                                        {req.status}
                                    </span>
                                    <span className="text-xs text-gray-400 shrink-0">
                                        {format(new Date(req.created_at), 'dd MMM, hh:mm a')}
                                    </span>
                                </div>
                            </div>

                            {/* Customer + Options — single row */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-bold text-gray-800 truncate">{req.customer_name || 'Guest'}</span>
                                    <a href={`tel:${req.customer_phone}`} className="text-xs text-blue-600 flex items-center gap-0.5 font-medium shrink-0">
                                        <Phone size={10} /> {req.customer_phone}
                                    </a>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${req.print_type === 'color' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-700'}`}>
                                        {req.print_type === 'bw' ? 'B&W' : 'Color'}
                                    </span>
                                    {req.orientation && (
                                        <span className="text-[10px] font-medium capitalize">{req.orientation}</span>
                                    )}
                                    {req.copies > 1 && (
                                        <span className="text-[10px] font-medium">×{req.copies}</span>
                                    )}
                                </div>
                            </div>

                            {/* Note */}
                            {req.customer_note && (
                                <p className="text-gray-500 italic text-[11px] border-l-2 border-gray-200 pl-2 mb-2 truncate">
                                    "{req.customer_note}"
                                </p>
                            )}

                            {/* Files — clickable cards with preview */}
                            <div className="flex flex-wrap gap-2 mb-2">
                                {req.files?.map((file, i) => (
                                    <button
                                        key={i}
                                        onClick={() => openFile(file.url)}
                                        className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all p-2 w-20"
                                    >
                                        {isImage(file) ? (
                                            <img
                                                src={file.url}
                                                alt={file.name}
                                                className="w-14 h-14 object-cover rounded-lg"
                                                onError={(e) => { e.target.style.display = 'none' }}
                                            />
                                        ) : (
                                            <div className="w-14 h-14 bg-red-50 rounded-lg flex items-center justify-center">
                                                <FileText size={28} className="text-red-400" />
                                            </div>
                                        )}
                                        <span className="text-[9px] font-medium text-gray-500 truncate w-full text-center">{file.name}</span>
                                        <span className="text-[8px] text-blue-500 flex items-center gap-0.5"><Eye size={8} /> View</span>
                                    </button>
                                ))}
                            </div>

                            {/* Actions — compact */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                                {req.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => updateStatus(req.id, 'accepted')}
                                            className="bg-[#023430] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                                        >
                                            <Check size={12} /> Accept
                                        </button>
                                        <button
                                            onClick={() => updateStatus(req.id, 'rejected')}
                                            className="bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                                        >
                                            <X size={14} />
                                        </button>
                                    </>
                                )}

                                {req.status === 'accepted' && (
                                    <button
                                        onClick={() => updateStatus(req.id, 'completed')}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                                    >
                                        <Check size={12} /> Mark Done
                                    </button>
                                )}

                                {(req.status === 'completed' || req.status === 'rejected') && (
                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${req.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                                        {req.status === 'completed' ? <><Check size={12} /> Done</> : <><X size={12} /> Rejected</>}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
