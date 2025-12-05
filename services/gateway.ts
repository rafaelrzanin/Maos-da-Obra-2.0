import { PlanType, User } from '../types';

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO GATEWAY (NEON)
// ---------------------------------------------------------------------------

// URL base da API da Neon (checkout API)
const API_URL = "https://api.neonpay.com"; // endpoint oficial da Neon /checkout :contentReference[oaicite:1]{index=1}

// ⚠️ IMPORTANTE:
// Cria no Vercel (ou no .env) a variável VITE_NEON_API_KEY
// com a chave que a Neon te deu (chave SECRETA de servidor, NÃO expor publicamente).
const NEON_API_KEY = import.meta.env.VITE_NEON_API_KEY as string | undefined;

// Mapeia os tipos de plano do app para o "código de plano" interno
// que você configurou lá na Neon (SKU / Offer / Product Code, etc.)
const GATEWAY_PLAN_IDS: Record<PlanType, string> = {
  [PlanType.MENSAL]: "Mãos da Obra - Plano Mensal",        // <-- troque pelo SKU real do plano mensal na Neon
  [PlanType.SEMESTRAL]: "Mãos da Obra - Plano Semestral",  // <-- troque pelo SKU real do plano semestral
  [PlanType.VITALICIO]: "Mãos da Obra - Plano Vitalício"   // <-- troque pelo SKU real do vitalício
};

// Mapeia PlanType (enum do app) para o texto que o webhook espera ("monthly", etc.)
const NEON_PLAN_TYPE: Record<PlanType, "monthly" | "semiannual" | "lifetime"> = {
  [PlanType.MENSAL]: "monthly",
  [PlanType.SEMESTRAL]: "semiannual",
  [PlanType.VITALICIO]: "lifetime"
};

export const gatewayService = {
  /**
   * Cria uma sessão de checkout na Neon e devolve a URL de redirecionamento.
   */
  checkout: async (user: User, planType: PlanType): Promise<string> => {
    console.log(
      `[Gateway] Iniciando checkout Neon para ${user.email} no plano ${PlanType[planType]}...`
    );

    if (!NEON_API_KEY) {
      console.error("VITE_NEON_API_KEY não configurada.");
      throw new Error(
        "Configuração de pagamento ausente. Avise o suporte do Mãos da Obra."
      );
    }

    // SKU do plano na Neon (você que define no painel da Neon)
    const sku = GATEWAY_PLAN_IDS[planType];
    if (!sku) {
      throw new Error(
        `SKU do plano ${PlanType[planType]} não configurado em GATEWAY_PLAN_IDS.`
      );
    }

    // Tipo de plano em texto (para o webhook entender)
    const normalizedPlanType = NEON_PLAN_TYPE[planType];

    // -----------------------------------------------------------------------
    // MONTA O PAYLOAD PARA A NEON
    //
    // ⚠️ A Neon trabalha com "items" / "offers" / "SKU" cadastrados lá no painel.
    // O formato exato você pode confirmar clicando em "Try It" na doc
    // de POST https://api.neonpay.com/checkout, mas a ideia é essa:
    // -----------------------------------------------------------------------
    const payload: any = {
      // Lista de itens/serviços que vão pro checkout
      items: [
        {
          // Aqui você manda o SKU/código do plano que cadastrou na Neon
          sku,
          quantity: 1
        }
      ],

      // Metadados que vão viajar junto na compra e chegam no webhook
      metadata: {
        userId: user.id,                 // quem é o usuário no Supabase
        planType: normalizedPlanType,    // "monthly" | "semiannual" | "lifetime"
        email: user.email,
        name: user.name,
        source: "maos-da-obra"
      }

      // Se a Neon permitir mais campos (ex: orderNumber, countryCode, etc),
      // você pode acrescentar aqui conforme a documentação.
    };

    // -----------------------------------------------------------------------
    // CHAMADA HTTP PARA A NEON
    // -----------------------------------------------------------------------
    const url = `${API_URL.replace(/\/+$/, '')}/checkout`; // https://api.neonpay.com/checkout

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",

          // ⚠️ HEADER DE AUTENTICAÇÃO:
          // Verifica na doc ou no painel Neon se é:
          //   Authorization: Bearer <token>
          // ou
          //   X-Api-Key: <chave>
          //
          // Aqui vou deixar o mais comum:
          "Authorization": `Bearer ${NEON_API_KEY}`
          // Se a doc mandar usar outro header, é só trocar aqui.
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorText = "";
        try {
          errorText = await response.text();
        } catch {
          // ignora
        }
        console.error("Erro ao criar checkout Neon:", response.status, errorText);
        throw new Error(
          "Não foi possível iniciar o pagamento agora. Tente novamente em alguns minutos."
        );
      }

      const data: any = await response.json();

      // A doc da Neon diz que, ao criar o checkout, você deve redirecionar
      // o usuário para o `redirectUrl` retornado. :contentReference[oaicite:2]{index=2}
      const redirectUrl: string =
        data.redirectUrl ||
        data.url ||
        data.checkoutUrl ||
        "";

      if (!redirectUrl) {
        console.error("Resposta da Neon sem redirectUrl conhecido:", data);
        throw new Error(
          "Pagamento criado, mas não recebemos a URL do checkout. Verifique a integração com a Neon."
        );
      }

      return redirectUrl;

    } catch (error) {
      console.error("Erro no gateway de pagamento (Neon):", error);
      throw error;
    }
  },

  /**
   * Verifica o status via query string APÓS o redirecionamento de volta.
   * Obs.: isso é só visual pro usuário; quem manda mesmo é o webhook
   * atualizando o Supabase.
   */
  checkPaymentStatus: (
    searchParams: URLSearchParams
  ): "success" | "failure" | "pending" | null => {
    // Ajuste se a Neon mandar algum parâmetro específico na URL de retorno
    const status = searchParams.get("status") || searchParams.get("result");
    const errorCode = searchParams.get("error");

    if (status === "success" || status === "approved" || status === "completed") {
      return "success";
    }

    if (status === "failure" || status === "rejected" || errorCode) {
      return "failure";
    }

    return null;
  }
};
