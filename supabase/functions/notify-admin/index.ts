// @ts-nocheck
// Supabase Edge Function — runs on Deno (not Node.js).
// The TypeScript errors in VSCode are false positives from the Node TS compiler.
// This function works correctly when deployed to Supabase Edge Functions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import admin from "npm:firebase-admin@11.11.1";

// Initialize Firebase Admin from environment variable (set in Supabase dashboard)
const serviceAccountKey = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");

if (!admin.apps.length && serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    const table = payload.table;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all admin FCM tokens from Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: devices, error: dbError } = await supabaseClient
      .from("admin_devices")
      .select("fcm_token");

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!devices || devices.length === 0) {
      console.log("No admin devices registered.");
      return new Response(JSON.stringify({ success: true, message: "No devices" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const tokens: string[] = devices.map((d: { fcm_token: string }) => d.fcm_token).filter(Boolean);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No valid tokens" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build notification based on order type
    let title = "🛒 New Order Received!";
    let body = `Amount: ₹${record.total_amount || "?"}`;

    if (table === "print_orders") {
      title = "🖨️ New Print Order!";
      body = `${record.customer_name || "Customer"} — ${record.copies || 1} cop${record.copies === 1 ? "y" : "ies"} (${record.print_type === "color" ? "Color" : "B&W"})`;
    }

    const message = {
      notification: { title, body },
      data: {
        orderId: String(record.id),
        type: table,
      },
      android: {
        priority: "high", // Wakes up the device from Doze mode
        ttl: 86400000, // Keeps trying to deliver for 24 hours if phone is offline
        notification: {
          channelId: "orders_loud",
          sound: "loud_alarm.wav",
          defaultSound: false,
          defaultVibrateTimings: true,
          defaultLightSettings: true,
          visibility: "public", // Forces it to show on the lock screen
          priority: "max", // Max priority for a "heads-up" loud notification banner
        },
      },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Sent to ${response.successCount}/${tokens.length} devices`);

    return new Response(
      JSON.stringify({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Edge function error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});