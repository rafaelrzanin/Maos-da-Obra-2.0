
// api/send-event-notification.js
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: Supabase URL ou Key faltando para send-event-notification. Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas no Vercel.");
  // Em ambientes de produção/deploy, é melhor não lançar um erro aqui diretamente
  // para que a função possa retornar um erro 500 JSON, em vez de um erro Vercel padrão.
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure web-push with VAPID keys
// These should be set as environment variables in Vercel
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = "mailto:seuemail@example.com"; // Replace with your actual email

console.log(`[send-event-notification] VAPID_PUBLIC_KEY presence: ${!!VAPID_PUBLIC_KEY}`);
console.log(`[send-event-notification] VAPID_PRIVATE_KEY presence: ${!!VAPID_PRIVATE_KEY}`);


if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("ERRO CRÍTICO: Chaves VAPID (PUBLIC_KEY ou PRIVATE_KEY) faltando para notificações push. Certifique-se de que VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY estão configuradas no Vercel.");
  // Em ambientes de produção/deploy, é melhor não lançar um erro aqui diretamente
  // para que a função possa retornar um erro 500 JSON, em vez de um erro Vercel padrão.
} else {
  webpush.setVapidDetails(
    VAPID_EMAIL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try { // Start of broad try-catch for consistent JSON error responses
    const { userId, title, body, url, tag } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'userId, title, and body are required.' });
    }

    // Check if VAPID keys are configured before proceeding to send notifications
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("[send-event-notification] VAPID keys not configured. Cannot send push notifications.");
      return res.status(500).json({ error: 'Server not configured for push notifications. VAPID keys missing.' });
    }

    // 1. Fetch user's push subscription from Supabase
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (error) {
      console.error("[send-event-notification] Error fetching subscriptions:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No active subscriptions for this user.' });
    }
    
    // 2. Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: title,
      body: body,
      icon: `${req.headers.origin}/ze.png`, // Full URL to icon
      url: url || req.headers.origin, // Default to app origin
      tag: tag || 'maos-da-obra-notification',
    });

    // 3. Send notification to all active subscriptions
    const sendPromises = subscriptions.map(async (subRecord) => {
      try {
        await webpush.sendNotification(
          subRecord.subscription,
          notificationPayload
        );
        console.log(`[send-event-notification] Notification sent to user ${userId} via endpoint ${subRecord.subscription.endpoint}`);
      } catch (sendError) {
        console.error(`[send-event-notification] Error sending notification to ${subRecord.subscription.endpoint}:`, sendError);
        // If subscription is no longer valid, delete it from our DB
        if (sendError.statusCode === 410 || sendError.statusCode === 404) {
            console.log(`[send-event-notification] Subscription for user ${userId} is stale, deleting...`);
            // Ensure endpoint is extracted safely if subscription.endpoint is not directly accessible
            const endpointToDelete = subRecord.subscription?.endpoint;
            if (endpointToDelete) {
                await supabase.from('user_subscriptions').delete().eq('endpoint', endpointToDelete);
            }
        }
      }
    });

    await Promise.allSettled(sendPromises); // Use allSettled to ensure all promises resolve/reject

    return res.status(200).json({ message: 'Notifications processed.' });

  } catch (error) {
    console.error("[send-event-notification] Internal Server Error in send-event-notification:", error);
    // Ensure that any unhandled error also returns a JSON response
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}