
// api/send-daily-notifications.js
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Supabase client initialization
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: Supabase URL ou Key missing for daily notifications.");
  // throw new Error("Supabase configuration missing."); // Avoid throwing during deployment
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Web-push VAPID key configuration (same as send-event-notification)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = "mailto:seuemail@example.com"; // Replace with your actual email

console.log(`[send-daily-notifications] VAPID_PUBLIC_KEY presence: ${!!VAPID_PUBLIC_KEY}`);
console.log(`[send-daily-notifications] VAPID_PRIVATE_KEY presence: ${!!VAPID_PRIVATE_KEY}`);


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

// Helper para obter a data local da meia-noite
const getLocalMidnightDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0); // Meia-noite local
};

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
    const { data, error } = await supabase.from('steps').select('*').eq('work_id', workId).order('start_date', { ascending: true });
    if (error) return [];
    return data || [];
  },
  async getMaterials(workId) {
    const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId);
    if (error) return [];
    return data || [];
  },
  async getExpenses(workId) {
    const { data, error } = await supabase.from('expenses').select('amount').eq('work_id', workId);
    if (error) return [];
    return data || [];
  },
  async addNotification(notification) {
    const { data: newNotificationData, error: addNotificationError } = await supabase.from('notifications').insert({
      user_id: notification.userId,
      work_id: notification.workId,
      title: notification.title,
      message: notification.message,
      date: notification.date,
      read: notification.read,
      type: notification.type,
      tag: notification.tag
    }).select().single();
    if (addNotificationError) {
      console.error("Error adding notification:", addNotificationError.message);
      throw addNotificationError;
    }
    return newNotificationData;
  },
  async getExistingNotificationByTag(userId, workId, tag) {
      const { data, error } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('work_id', workId)
          .eq('tag', tag)
          .eq('read', false)
          .maybeSingle();
      if (error) {
          console.error(`Error checking existing notification for tag ${tag}:`, error);
          return null;
      }
      return data;
  }
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
    // 1. Fetch all active push subscriptions (users who opted in)
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*');

    if (subsError) {
      console.error("[send-daily-notifications] Error fetching all subscriptions:", subsError);
      return res.status(500).json({ error: subsError.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[send-daily-notifications] No active subscriptions found for daily notifications.");
      return res.status(200).json({ message: 'No active subscriptions to send daily notifications to.' });
    }

    const todayLocalMidnight = new Date();
    todayLocalMidnight.setHours(0, 0, 0, 0); // Meia-noite local de hoje
    const todayDateString = todayLocalMidnight.toISOString().split('T')[0]; // Para tags de notificação

    const threeDaysFromNowLocalMidnight = new Date(todayLocalMidnight);
    threeDaysFromNowLocalMidnight.setDate(todayLocalMidnight.getDate() + 3); // Meia-noite local 3 dias à frente (inclusive)

    const APP_URL = process.env.VITE_APP_URL || req.headers.origin;


    const sendPromises = subscriptions.map(async (subRecord) => {
      try {
        const userId = subRecord.user_id;
        const userWorks = await serverDbService.getWorks(userId);
        
        let notificationBody = `Olá! Resumo das suas obras para hoje, ${new Date().toLocaleDateString('pt-BR')}: 🏗️\n`; // Adiciona a data atual

        if (userWorks.length === 0) {
            notificationBody += "Parece que você ainda não tem obras cadastradas. Que tal começar uma nova?\n\nToque para abrir o app e iniciar seu projeto!";
        } else {
            for (const work of userWorks) {
                const workId = work.id;
                const steps = await serverDbService.getSteps(workId);
                const materials = await serverDbService.getMaterials(workId);
                const expenses = await serverDbService.getExpenses(workId);

                const totalSteps = steps.length;
                const completedSteps = steps.filter(s => s.status === 'CONCLUIDO').length;
                const delayedSteps = steps.filter(s => s.status !== 'CONCLUIDO' && new Date(s.endDate) < todayLocalMidnight).length;
                
                const pendingMaterialsCount = materials.filter(m => m.purchased_qty < m.planned_qty).length;
                const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
                const budgetStatus = work.budgetPlanned > 0 && totalSpent > work.budgetPlanned ? 'Orçamento Estourado ⚠️' : 'Dentro do previsto ✅';
                const cronogramaStatus = delayedSteps > 0 ? `Atrasado (${delayedSteps} etapas) ❌` : 'Em dia ✅';
                
                notificationBody += `\nObra: ${work.name}\n`;
                notificationBody += `  Cronograma: ${cronogramaStatus}\n`;
                notificationBody += `  Progresso: ${totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0}% (${completedSteps}/${totalSteps} etapas concluídas)\n`;
                notificationBody += `  Materiais Pendentes: ${pendingMaterialsCount}\n`;
                notificationBody += `  Financeiro: ${budgetStatus}\n`;

                // --- LÓGICA DE NOTIFICAÇÃO DE MATERIAIS - AGORA NO SERVIDOR ---
                const relevantStepsForMaterials = steps.filter(s => {
                    const stepStartDate = getLocalMidnightDate(s.startDate);
                    // Etapa começa hoje ou nos próximos 3 dias OU etapa já começou e não está concluída
                    return (
                        (stepStartDate >= todayLocalMidnight && stepStartDate <= threeDaysFromNowLocalMidnight) ||
                        (stepStartDate <= todayLocalMidnight && s.status !== 'CONCLUIDO')
                    );
                });

                for (const step of relevantStepsForMaterials) {
                    const materialsForStep = materials.filter(m => m.step_id === step.id); // Usar `step_id` do DB

                    for (const material of materialsForStep) {
                        if (material.planned_qty > 0 && material.purchased_qty < material.planned_qty) {
                            // Notificar se menos de 80% do material foi comprado (limiar de "pouco estoque")
                            // Ou se nada foi comprado para material de uma etapa que já começou
                            if ((material.purchased_qty / material.planned_qty) < 0.8 || (material.purchased_qty === 0 && getLocalMidnightDate(step.startDate) <= todayLocalMidnight)) {
                                const notificationTag = `work-${workId}-low-material-${material.id}-${step.id}-${todayDateString}`;

                                const existingNotif = await serverDbService.getExistingNotificationByTag(userId, workId, notificationTag);

                                if (!existingNotif) {
                                    console.log(`[NOTIF GENERATION - CRON] Adding low material notification: "${material.name}" for step "${step.name}" (Work: "${work.name}")`);
                                    await serverDbService.addNotification({
                                        userId,
                                        workId,
                                        title: `Material em falta para a etapa ${step.name}!`,
                                        message: `O material "${material.name}" (${material.purchased_qty}/${material.planned_qty} ${material.unit}) para a etapa "${step.name}" da obra "${work.name}" está em falta. Faça a compra!`,
                                        date: new Date().toISOString(),
                                        read: false,
                                        type: 'WARNING',
                                        tag: notificationTag
                                    });
                                    // Envia a push notification
                                    await webpush.sendNotification(
                                        subRecord.subscription,
                                        JSON.stringify({
                                            title: `Material em falta: ${step.name}!`,
                                            body: `O material "${material.name}" (${material.purchased_qty}/${material.planned_qty} ${material.unit}) para a etapa "${step.name}" está em falta.`,
                                            icon: `${APP_URL}/ze.png`,
                                            url: `${APP_URL}/work/${workId}#MATERIAIS`, // Deep link para a aba de materiais
                                            tag: notificationTag
                                        })
                                    );
                                }
                            }
                        }
                    }
                }
                // --- FIM DA LÓGICA DE NOTIFICAÇÃO DE MATERIAIS ---
            }
            notificationBody += "\nToque para mais detalhes!";
        }

        // Send the daily summary notification (always generated)
        await webpush.sendNotification(
          subRecord.subscription,
          JSON.stringify({
            title: 'Mãos da Obra: Resumo Diário! 🏗️',
            body: notificationBody,
            icon: `${APP_URL}/ze.png`,
            url: APP_URL, // Base URL for daily summary
            tag: 'maos-da-obra-daily-summary', // Tag para o resumo diário
          })
        );
        console.log(`[send-daily-notifications] Daily summary notification sent to user ${userId}.`);

      } catch (sendError) {
        console.error(`[send-daily-notifications] Error processing/sending daily notification to ${subRecord.endpoint}:`, sendError);
        // If subscription is no longer valid, delete it from our DB
        if (sendError.statusCode === 410 || sendError.statusCode === 404) {
            console.log(`[send-daily-notifications] Subscription for user ${subRecord.user_id} is stale, deleting...`);
            await supabase.from('user_subscriptions').delete().eq('endpoint', subRecord.subscription.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return res.status(200).json({ message: 'Daily notifications processed successfully.' });

  } catch (error) {
    console.error("[send-daily-notifications] Internal Server Error in daily-notifications:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
    