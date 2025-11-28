
import { PlanType, User } from '../types';

// --- CONFIGURAÇÃO DO GATEWAY ---
// Substitua pelos dados reais da sua API de pagamento

// Mapeamento de IDs do seu gateway para os planos do App
const GATEWAY_PLAN_IDS = {
  [PlanType.MENSAL]: "plano_mensal_id_123",
  [PlanType.SEMESTRAL]: "plano_semestral_id_456",
  [PlanType.VITALICIO]: "plano_vitalicio_id_789"
};

// URL da sua API que gera o checkout
// const API_ENDPOINT = "https://api.seugateway.com/v1/checkout";
// const API_KEY = "SUA_CHAVE_PUBLICA"; 

export const gatewayService = {
  /**
   * Chama a API do gateway para gerar um link de pagamento
   * e retorna a URL para redirecionamento.
   */
  checkout: async (user: User, planType: PlanType): Promise<string> => {
    console.log(`[Gateway] Iniciando checkout para ${user.email} no plano ${planType}...`);

    // ---------------------------------------------------------
    // EXEMPLO DE IMPLEMENTAÇÃO REAL (Descomente e ajuste):
    // ---------------------------------------------------------
    /*
    try {
      const response = await fetch("https://sua-api.com/checkout", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_API_KEY}`
        },
        body: JSON.stringify({
          plan_id: GATEWAY_PLAN_IDS[planType],
          customer: {
            name: user.name,
            email: user.email,
            phone: user.whatsapp
          },
          success_url: window.location.origin + "/#/settings?status=success",
          cancel_url: window.location.origin + "/#/settings?status=cancel"
        })
      });

      if (!response.ok) throw new Error('Erro ao criar checkout');

      const data = await response.json();
      return data.checkout_url; // A URL que o gateway devolveu
    } catch (error) {
      console.error("Erro no pagamento:", error);
      throw error;
    }
    */

    // ---------------------------------------------------------
    // SIMULAÇÃO (Para o MVP funcionar visualmente):
    // ---------------------------------------------------------
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Retorna uma URL fictícia de checkout
    // Em produção, isso viria da sua API
    const baseUrl = "https://checkout.pagamento.com"; 
    const planId = GATEWAY_PLAN_IDS[planType];
    const userEmail = encodeURIComponent(user.email);
    
    return `${baseUrl}/pay/${planId}?email=${userEmail}`;
  }
};
