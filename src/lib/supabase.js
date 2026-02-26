import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vkbhvzgcnagxyhoiuaoj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dPTk3YsvJLI-xcgrhps_RA_zWBYl9K9'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Store coordinates (Chittapur, Karnataka)
export const STORE_LOCATION = {
    lat: 16.9329,
    lng: 77.0182,
}

export const STORE_PHONE = '7892040943'
export const STORE_NAME = 'MRN MULLA KIRANA'
export const STORE_LOCATION_TEXT = 'Nalwar Station, Karnataka'
export const DELIVERY_RADIUS_KM = 5

// Cloudinary
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dvg5a6dl5'
export const CLOUDINARY_UPLOAD_PRESET = 'mrn_products'

// Razorpay Key
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || ''
