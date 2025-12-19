
// api/send-daily-notifications.js
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Supabase client initialization
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: Supabase URL or Key missing for daily notifications.");
  // throw new Error("Supabase configuration missing."); // Avoid throwing during deployment
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Web-push VAPID key configuration (same as send-event-notification)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = "mailto:seuemail@example.com"; // Replace with your actual email

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("CRITICAL ERROR: VAPID keys missing for daily push notifications.");
} else {
    webpush.setVapidDetails(
        VAPID_EMAIL,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

// ===============================================
// Mock/Simplified dbService for Serverless context
// (In a real scenario, you'd import and use dbService
// but it needs to be adapted for server-side usage
// as it currently depends on browser APIs/global window)
// ===============================================
const serverDbService = {
  async getWorks(userId) {
    const { data, error } = await supabase.from('works').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) {
      console.error(`Error fetching works for user ${userId}:`, error);
      return [];
    }
    return data || [];
  },
  async getSteps(workId) {
    const { data, error } = await supabase.from('steps').select('*').eq('work_id', workId);
    if (error) return [];
    return data || [];
  },
  async getMaterials(workId) {
    const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId);
    if (error) return [];
    return data || [];
  },
  async getExpenses(workId) {
    const { data, error } = await supabase.from('expenses').select('*').eq('work_id', workId);
    if (error) return [];
    return data || [];
  },
};
// ===============================================

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  console.log("--- Executing Daily Notifications Cron Job ---");

  try {
    // 1. Fetch all active push subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*');

    if (subsError) {
      console.error("Error fetching all subscriptions:", subsError);
      return res.status(500).json({ error: subsError.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No active subscriptions found for daily notifications.");
      return res.status(200).json({ message: 'No active subscriptions to send daily notifications to.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sendPromises = subscriptions.map(async (subRecord) => {
      try {
        const userId = subRecord.user_id;
        // 2. Fetch user's data to build summary
        const works = await serverDbService.getWorks(userId);
        
        let notificationBody = "Bom dia! 👷‍♂️\n";
        let hasActiveWork = false;

        if (works.length === 0) {
            notificationBody += "Parece que você ainda não tem obras cadastradas. Que tal começar uma nova?\n\nToque para abrir o app e iniciar seu projeto!";
        } else {
            hasActiveWork = true;
            for (const work of works) {
                const workId = work.id;
                const steps = await serverDbService.getSteps(workId);
                const materials = await serverDbService.getMaterials(workId);
                const expenses = await serverDbService.getExpenses(workId);

                const totalSteps = steps.length;
                const completedSteps = steps.filter(s => s.status === 'CONCLUIDO').length;
                const delayedSteps = steps.filter(s => s.status !== 'CONCLUIDO' && new Date(s.endDate) < today).length;
                
                const pendingMaterials = materials.filter(m => m.purchased_qty < m.planned_qty).length;
                const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
                const budgetStatus = work.budgetPlanned > 0 && totalSpent > work.budgetPlanned ? 'Orçamento Estourado ⚠️' : 'Dentro do previsto ✅';
                const cronogramaStatus = delayedSteps > 0 ? `Atrasado (${delayedSteps} etapas) ❌` : 'Em dia ✅';
                
                notificationBody += `\nObra: ${work.name}\n`;
                notificationBody += `  Cronograma: ${cronogramaStatus}\n`;
                notificationBody += `  Progresso: ${totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0}% (${completedSteps}/${totalSteps} etapas concluídas)\n`;
                notificationBody += `  Materiais Pendentes: ${pendingMaterials}\n`;
                notificationBody += `  Financeiro: ${budgetStatus}\n`;
            }
            notificationBody += "\nToque para mais detalhes!";
        }

        const notificationPayload = JSON.stringify({
          title: 'Mãos da Obra: Resumo Diário! 🏗️',
          body: notificationBody,
          icon: `${req.headers.origin}/ze.png`,
          url: req.headers.origin, // Base URL for daily summary
          tag: 'maos-da-obra-daily-summary',
        });

        await webpush.sendNotification(
          subRecord.subscription,
          notificationPayload
        );
        console.log(`Daily notification sent to user ${userId}.`);
      } catch (sendError) {
        console.error(`Error sending daily notification to ${subRecord.endpoint}:`, sendError);
        // If subscription is no longer valid, delete it from our DB
        if (sendError.statusCode === 410 || sendError.statusCode === 404) {
            console.log(`Subscription for user ${subRecord.user_id} is stale, deleting...`);
            await supabase.from('user_subscriptions').delete().eq('endpoint', subRecord.subscription.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return res.status(200).json({ message: 'Daily notifications processed successfully.' });

  } catch (error) {
    console.error("Internal Server Error in daily-notifications:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
