// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // Find completed print orders where:
        // 1. Status is 'completed'
        // 2. delivered_at was set more than 1 hour ago
        // 3. Files have not been deleted yet
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

        const { data: ordersToClean, error: fetchError } = await supabaseAdmin
            .from('print_orders')
            .select('id, files')
            .eq('status', 'completed')
            .eq('files_deleted', false)
            .lt('delivered_at', oneHourAgo)

        if (fetchError) throw fetchError

        if (!ordersToClean || ordersToClean.length === 0) {
            return new Response(JSON.stringify({ message: 'No files to clean up', cleaned: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let cleaned = 0
        const errors = []

        for (const order of ordersToClean) {
            try {
                const files = order.files || []
                const fileNames = files
                    .map((f: any) => {
                        // Extract just the file name from the full URL
                        const url = f.url || ''
                        const parts = url.split('/print-docs/')
                        return parts[1] ? decodeURIComponent(parts[1]) : null
                    })
                    .filter(Boolean)

                if (fileNames.length > 0) {
                    const { error: storageError } = await supabaseAdmin.storage
                        .from('print-docs')
                        .remove(fileNames)

                    if (storageError) {
                        console.error(`Storage delete error for order ${order.id}:`, storageError)
                        errors.push({ id: order.id, error: storageError.message })
                        continue
                    }
                }

                // Mark as deleted in DB
                await supabaseAdmin
                    .from('print_orders')
                    .update({ files_deleted: true, files: [] })
                    .eq('id', order.id)

                cleaned++
                console.log(`Cleaned files for order ${order.id}`)

            } catch (err) {
                errors.push({ id: order.id, error: err.message })
            }
        }

        return new Response(JSON.stringify({
            message: `Cleaned ${cleaned} orders`,
            cleaned,
            errors: errors.length ? errors : undefined
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Cleanup error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
