/**
 * Supabase Client with Clerk Integration (Native Integration)
 *
 * This client automatically injects Clerk session tokens into Supabase requests,
 * enabling Row Level Security (RLS) policies to work with Clerk authentication.
 *
 * Based on: https://clerk.com/docs/guides/development/integrations/databases/supabase
 * Uses the NEW native integration (JWT templates are deprecated as of April 2025)
 *
 * IMPORTANT: Requires Clerk Supabase integration to be enabled:
 * 1. Go to Clerk Dashboard → Integrations → Supabase
 * 2. Click "Activate Supabase integration"
 * 3. Copy your Clerk domain
 * 4. In Supabase Dashboard → Authentication → Sign In / Up
 * 5. Add Clerk as a third-party provider with your Clerk domain
 */

import React from "react";
import { createClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client with Clerk session token (Native Integration)
 *
 * This uses the NEW native Supabase integration that doesn't require JWT templates.
 * The session.getToken() method returns the Clerk session token that Supabase validates.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const supabase = useSupabaseClient();
 *
 *   const { data } = await supabase
 *     .from('agent_sessions')
 *     .select('*')
 *     .eq('project_id', projectId);
 * }
 * ```
 */
export function useSupabaseClient() {
  const { session } = useSession();

  // Store session in a ref so the accessToken callback always has the latest value
  const sessionRef = React.useRef(session);

  // Update the ref whenever session changes
  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Create client only once - it never needs to be recreated
  // This prevents subscriptions from closing/reopening when session changes
  const client = React.useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- sessionRef is intentionally accessed in accessToken callback (not during render)
    return createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        // Enable web workers to prevent heartbeat throttling
        // Without this, browser timer throttling breaks the 60-second heartbeat requirement
        // causing subscriptions to close after ~2 minutes
        worker: true,
      },
      async accessToken() {
        // Use the ref to always get the latest session token
        // IMPORTANT: Must await getToken() to return string, not Promise<string>
        // The ref is accessed here (in the callback), NOT during render - this is safe
        if (!sessionRef.current) return null;
        try {
          return await sessionRef.current.getToken({ skipCache: true });
        } catch (error) {
          console.error("[Supabase] Failed to fetch Clerk token:", error);
          return null;
        }
      },
    });
  }, []); // Empty dependency array - client is stable across renders

  return client;
}

/**
 * Server-side Supabase client (without Clerk auth)
 *
 * Use this in API routes and server components where you don't have a Clerk session.
 * For authenticated operations, use the service role client from supabase-admin.ts
 */
export const supabaseServerClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);
