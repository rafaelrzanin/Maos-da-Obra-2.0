import { PlanType, User } from '../types';

// --- CONFIGURAÇÃO DO GATEWAY ---
// Coloca aquí las credenciales de tu portal de pago
// const API_URL = "https://api.tu-portal-de-pago.com/v1"; // Reemplazar con la URL real
// const PUBLIC_KEY = "TU_PUBLIC_KEY"; // Si la API requiere auth desde el front

// IDs de los planes en tu portal de pago
const GATEWAY_PLAN_IDS = {
  [PlanType.MENSAL]: "plan_id_mensal_real",
  [PlanType.SEMESTRAL]: "plan_id_semestral_real",
  [PlanType.VITALICIO]: "plan_id_vitalicio_real"
};

export const gatewayService = {
  /**
   * Crea una sesión de checkout en el portal de pago.
   */
  checkout: async (user: User, planType: PlanType): Promise<string> => {
    console.log(`[Gateway] Iniciando checkout para ${user.email} no plano ${planType}...`);

    try {
      // 1. Preparar el cuerpo de la solicitud según la documentación de tu API
      /* 
      const payload = {
        items: [
          {
            id: GATEWAY_PLAN_IDS[planType],
            title: `Assinatura Mãos da Obra - ${planType}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: planType === PlanType.VITALICIO ? 247.00 : (planType === PlanType.SEMESTRAL ? 97.00 : 29.90)
          }
        ],
        payer: {
          email: user.email,
          name: user.name,
          // phone: user.whatsapp // Opcional dependiendo de la API
        },
        external_reference: user.id, // IMPORTANTE: Para vincular el pago al usuario en el Webhook
        back_urls: {
          success: `${window.location.origin}/settings?status=success`,
          failure: `${window.location.origin}/settings?status=failure`,
          pending: `${window.location.origin}/settings?status=pending`
        },
        auto_return: "approved"
      };
      */

      // 2. Hacer la llamada a la API (Ejemplo genérico, ajustar headers según documentación)
      /* 
      const response = await fetch(`${API_URL}/checkout/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PUBLIC_KEY}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar preferência de pagamento');
      }

      const data = await response.json();
      return data.init_point; // URL de redirección (Mercado Pago usa init_point, Stripe usa url, etc.)
      */

      // --- SIMULACIÓN PARA MANTENER LA APP FUNCIONANDO MIENTRAS INTEGRAS ---
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simula que la API devolvió una URL de pago real
      // En produção, descomenta el bloque fetch de arriba y elimina esto
      const mockCheckoutUrl = `https://checkout.pagamento.com/pay/${GATEWAY_PLAN_IDS[planType]}?ref=${user.id}`;
      console.warn("MODO SIMULACIÓN: Redirigiendo a URL ficticia. Implementar fetch real en services/gateway.ts");
      
      return mockCheckoutUrl;

    } catch (error) {
      console.error("Erro no gateway de pagamento:", error);
      throw error;
    }
  },

  /**
   * Verifica si una transacción fue exitosa basado en los parámetros de la URL
   * (Útil para feedback inmediato en el frontend, pero NO para seguridad final)
   */
  checkPaymentStatus: (searchParams: URLSearchParams): 'success' | 'failure' | 'pending' | null => {
    const status = searchParams.get('status');
    // const paymentId = searchParams.get('payment_id'); // O el parámetro que use tu gateway

    if (status === 'approved' || status === 'success') {
      return 'success';
    }
    if (status === 'failure' || status === 'rejected') {
      return 'failure';
    }
    return null;
  }
};
