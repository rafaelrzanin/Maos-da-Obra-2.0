import { PlanType, User } from '../types';

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO GATEWAY (NEONPAY)
// ---------------------------------------------------------------------------

// Base da API da NeonPay:
// Pela doc, o exemplo usa: https://app.neonpay.com.br/api/v1
// helper pra acessar import.meta.env sem encher o saco do TypeScript
const env = (import.meta as any).env || {};

const API_BASE_URL =
  (env.VITE_NEON_API_BASE_URL as string | undefined) ||
  'https://app.neonpay.com.br/api/v1';

const NEON_PUBLIC_KEY = env.VITE_NEON_PUBLIC_KEY as string | undefined;
const NEON_SECRET_KEY = env.VITE_NEON_SECRET_KEY as string | undefined;

// IDs externos (externalId) para identificar cada plano na Neon
const GATEWAY_PLAN_IDS = {
  [PlanType.MENSAL]: 'MAOS_MENSAL',       // pode trocar por outro ID se quiser
  [PlanType.SEMESTRAL]: 'MAOS_SEMESTRAL',
  [PlanType.VITALICIO]: 'MAOS_VITALICIO'
};

// Mapeia o enum PlanType para o texto que o webhook vai usar
const NEON_PLAN_TYPE: Record<PlanType, 'monthly' | 'semiannual' | 'lifetime'> = {
  [PlanType.MENSAL]: 'monthly',
  [PlanType.SEMESTRAL]: 'semiannual',
  [PlanType.VITALICIO]: 'lifetime'
};

export const gatewayService = {
  /**
   * Cria uma sessão de checkout NeonPay e retorna a checkoutUrl
   */
  checkout: async (user: User, planType: PlanType): Promise<string> => {
    console.log(
      `[Gateway] Iniciando checkout NeonPay para ${user.email} no plano ${PlanType[planType]}...`
    );

    if (!NEON_PUBLIC_KEY || !NEON_SECRET_KEY) {
      console.error('Chaves da NeonPay não configuradas.');
      throw new Error(
        'Configuração de pagamento ausente. Avise o suporte do Mãos da Obra.'
      );
    }

    const externalId = GATEWAY_PLAN_IDS[planType];
    if (!externalId) {
      throw new Error(
        `GATEWAY_PLAN_IDS não configurado para o plano ${PlanType[planType]}.`
      );
    }

    const normalizedPlanType = NEON_PLAN_TYPE[planType];

    // Valores em centavos (ajuste para os preços reais do Mãos da Obra)
    const priceInCents =
      planType === PlanType.VITALICIO
        ? 24700   // R$ 247,00
        : planType === PlanType.SEMESTRAL
        ? 9700    // R$ 97,00
        : 2990;   // R$ 29,90

    // -----------------------------------------------------------------------
    // BODY NO FORMATO QUE A DOC DA NEON MOSTROU (/gateway/checkout)
    // -----------------------------------------------------------------------
    const payload = {
      product: {
        name: `Mãos da Obra - Plano ${PlanType[planType]}`,
        externalId, // ID pra identificar esse plano na Neon
        photos: [
          // Coloca aqui uma imagem do teu app (pode trocar depois)
          'https://www.maosdaobra.online/img/checkout-banner.png'
        ],
        offer: {
          name: `Plano ${PlanType[planType]}`,
          price: priceInCents,   // em centavos
          offerType: 'NATIONAL',
          currency: 'BRL',
          lang: 'pt-BR'
        }
      },
      settings: {
        paymentMethods: ['PIX', 'CREDIT_CARD'],
        acceptedDocs: ['CPF'],
        thankYouPage: `${window.location.origin}/#/settings?status=success`,
        askForAddress: false,
        colors: {
          primaryColor: '#FFB629',
          text: '#111111',
          background: '#FFFFFF',
          purchaseButtonBackground: '#FFB629',
          purchaseButtonText: '#111111',
          widgets: '#F5F5F5',
          inputBackground: '#F1F1F1',
          inputText: '#333333'
        }
      },
      customer: {
        name: user.name,
        email: user.email,
        phone: (user as any).whatsapp || '',
        document: (user as any).cpf || ''
        // Se quiser usar address, adiciona aqui seguindo o exemplo da doc
      },
      trackProps: {
        userId: user.id,               // pro webhook saber quem liberar
        planType: normalizedPlanType,  // "monthly" | "semiannual" | "lifetime"
        source: 'maos-da-obra'
      }
    };

    const url = `${API_BASE_URL.replace(/\/+$/, '')}/gateway/checkout`;

    console.log('[Gateway] Enviando payload para NeonPay:', payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': NEON_PUBLIC_KEY,
        'x-secret-key': NEON_SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {
        // ignora
      }
      console.error(
        'Erro ao criar checkout na NeonPay:',
        response.status,
        errorText
      );
      throw new Error(
        'Não foi possível iniciar o pagamento agora. Tente novamente em alguns minutos.'
      );
    }

    const data = (await response.json()) as {
      success: boolean;
      checkoutUrl: string;
    };

    if (!data.success || !data.checkoutUrl) {
      console.error('Resposta inesperada da NeonPay:', data);
      throw new Error(
        'Pagamento criado, mas não recebemos a URL do checkout. Verifique a integração.'
      );
    }

    console.log('[Gateway] Checkout criado com sucesso. URL:', data.checkoutUrl);
    return data.checkoutUrl;
  },

  /**
   * Verifica status via query string após o retorno (apenas UX, quem manda é o webhook)
   */
  checkPaymentStatus: (
    searchParams: URLSearchParams
  ): 'success' | 'failure' | 'pending' | null => {
    const status = searchParams.get('status');

    if (status === 'approved' || status === 'success' || status === 'paid') {
      return 'success';
    }
    if (status === 'failure' || status === 'rejected') {
      return 'failure';
    }
    if (status === 'pending') {
      return 'pending';
    }
    return null;
  }
};
