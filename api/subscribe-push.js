
// api/subscribe-push.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for use in serverless function
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas para a função subscribe-push.");
  throw new Error("Configuração do Supabase ausente.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId, subscription } = req.body;

  if (!userId || !subscription) {
    return res.status(400).json({ error: 'userId and subscription are required.' });
  }

  try {
    if (req.method === 'POST') {
      // Save subscription
      const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert(
          { 
            user_id: userId, 
            subscription: subscription, 
            endpoint: subscription.endpoint // Store endpoint for easier lookup
          },
          { onConflict: 'endpoint' } // Update if endpoint already exists
        )
        .select();

      if (error) {
        console.error("Error saving subscription:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ message: 'Subscription saved', data });

    } else if (req.method === 'DELETE') {
      // Delete subscription
      const { error } = await supabase
        .from('user_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint); // Ensure we delete the specific subscription

      if (error) {
        console.error("Error deleting subscription:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ message: 'Subscription deleted' });
    } else {
      res.setHeader('Allow', ['POST', 'DELETE', 'OPTIONS']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("Internal Server Error in subscribe-push:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
