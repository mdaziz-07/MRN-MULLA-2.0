// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cart, deliveryFee = 0 } = await req.json();

    if (!cart || cart.length === 0) {
      throw new Error("Cart is empty");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const productIds = cart.map((item: any) => item.id);

    const { data: dbProducts, error: dbError } = await supabase
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (dbError) throw new Error("Database error: " + dbError.message);

    let totalAmount = 0;
    cart.forEach((cartItem: any) => {
      const dbProduct = dbProducts?.find((p: any) => p.id === cartItem.id);
      if (dbProduct) {
        totalAmount += dbProduct.price * cartItem.quantity;
      }
    });

    totalAmount += deliveryFee;
    const amountInPaise = Math.round(totalAmount * 100);

    const rzpKey = Deno.env.get('RAZORPAY_KEY_ID');
    const rzpSecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    // NEW: Explicitly check if secrets are missing in the cloud
    if (!rzpKey || !rzpSecret) {
      throw new Error("Razorpay credentials are missing in Supabase Secrets!");
    }

    const basicAuth = btoa(`${rzpKey}:${rzpSecret}`);

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_${Date.now()}`
      }),
    });

    const orderData = await rzpResponse.json();

    if (orderData.error) {
      throw new Error("Razorpay API Error: " + orderData.error.description);
    }

    return new Response(JSON.stringify({
      success: true,
      orderId: orderData.id,
      amount: amountInPaise,
      totalRupees: totalAmount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    // THE FIX: Always return 200 OK so Capacitor doesn't swallow the error message!
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});