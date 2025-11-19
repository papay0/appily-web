import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Webhook event types
type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    created_at?: number;
    updated_at?: number;
  };
};

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.warn("⚠️ CLERK_WEBHOOK_SECRET not set - webhook verification disabled");
    // For development/testing, allow unverified webhooks
    const evt: ClerkWebhookEvent = await req.json();
    return processWebhook(evt);
  }

  // Get headers for webhook verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  return processWebhook(evt);
}

async function processWebhook(evt: ClerkWebhookEvent) {

  // Handle the webhook event
  try {
    switch (evt.type) {
      case "user.created": {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;

        await supabaseAdmin.from("users").insert({
          clerk_id: id,
          email: email_addresses?.[0]?.email_address || null,
          first_name: first_name || null,
          last_name: last_name || null,
          avatar_url: image_url || null,
        });

        console.log(`✅ User created in Supabase: ${id}`);
        break;
      }

      case "user.updated": {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;

        await supabaseAdmin
          .from("users")
          .update({
            email: email_addresses?.[0]?.email_address || null,
            first_name: first_name || null,
            last_name: last_name || null,
            avatar_url: image_url || null,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_id", id);

        console.log(`✅ User updated in Supabase: ${id}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${evt.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/*
 * DEPLOYMENT REMINDER:
 *
 * After deploying this app, you need to:
 *
 * 1. Go to Clerk Dashboard → Webhooks
 * 2. Click "Add Endpoint"
 * 3. Enter your webhook URL: https://your-deployment-url.vercel.app/api/webhooks/clerk
 * 4. Enable these events:
 *    - user.created
 *    - user.updated
 * 5. Copy the "Signing Secret" and add it to your .env.local and Vercel environment variables:
 *    CLERK_WEBHOOK_SECRET=whsec_...
 * 6. Uncomment the webhook verification code above (lines 22-55)
 * 7. Redeploy the application
 *
 * For local testing with webhooks, you can use ngrok:
 * - Run: ngrok http 3000
 * - Use the ngrok URL in Clerk webhook settings
 */
