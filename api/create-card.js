export default async function handler(req, res) {
  // 1. Configuração de Segurança (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-public-key, x-secret-key'
  );

  // Responde imediatamente a requisições OPTIONS (pré-voo CORS)
  if (req.method === 'OPTIONS') return res.status(200).end();

  // CORREÇÃO 405: Garante que apenas o método POST continue
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: "METHOD_NOT_ALLOWED", mensagem: "Apenas requisições POST são permitidas para esta API." });
  }

  try {
    console.log("--> [CARTÃO] Iniciando processamento...");

    // 2. Carrega as chaves da Vercel
    const publicKey = process.env.NEON_PUBLIC_KEY;
    const secretKey = process.env.NEON_SECRET_KEY;

    if (!publicKey || !secretKey) {
        return res.status(500).json({ erro: "CONFIG_ERROR", mensagem: "Chaves de API (NEON_PUBLIC_KEY ou NEON_SECRET_KEY) não configuradas." });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { amount, card, client, installments, planType } = body;

    // CORREÇÃO: Garante que amount seja number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ erro: "INVALID_AMOUNT", mensagem: "O valor do pagamento é inválido." });
    }

    // 3. Define se é Assinatura ou Pagamento Único
    const isSubscription = planType.toUpperCase() !== 'VITALICIO';
    
    // URL base da Neon
    const baseUrl = 'https://app.neonpay.com.br'; 
    // endpoint muda dependendo do tipo
    const endpoint = isSubscription ? '/gateway/card/subscription' : '/gateway/card/receive';
    
    console.log(`--> [CARTÃO] Modo: ${isSubscription ? 'ASSINATURA' : 'PAGAMENTO ÚNICO'}`);

    // CORREÇÃO DE FORMATO: Transforma 'MM/AA' para 'YYYY-MM'
    const [mes, anoCurto] = card.expiry.split('/');
    // Assume que AA é do século 21 (ex: 25 => 2025)
    const anoCompleto = `20${anoCurto}`;
    const expiresAtFormatado = `${anoCompleto}-${mes}`;

    // 4. Monta o Payload (Dados)
    let payload = {
        identifier: body.identifier || `txn_${Date.now()}`,
        amount: numericAmount, 
        clientIp: req.headers['x-forwarded-for'] || "127.0.0.1",
        client: {
            name: client.name,
            email: client.email,
            phone: client.phone,
            document: client.document,
            address: { 
                country: "BR",
                state: "SP",
                city: "São Paulo",
                zipCode: "01001-000",
                street: "Rua Digital",
                number: "100"
            }
        },
        card: {
            number: card.number.replace(/\s/g, ''),
            owner: card.name, // CORREÇÃO: Usando card.name do form como owner
            expiresAt: expiresAtFormatado, // Formato YYYY-MM
            cvv: card.cvv
        }
    };

    // Ajustes específicos para Assinatura (Subscription)
    if (isSubscription) {
        payload.subscription = {
            periodicityType: "MONTHS",
            periodicity: planType.toUpperCase() === 'SEMESTRAL' ? 6 : 1, // 1 ou 6 meses
            firstChargeIn: 0 
        };
        payload.product = {
            id: planType.toLowerCase(),
            name: `Plano ${planType}`,
            quantity: 1,
            price: numericAmount 
        };
    } else {
        // Ajustes específicos para Pagamento Único (Vitalício)
        payload.installments = parseInt(installments || 1);
        payload.products = [
            {
                id: "vitalicio",
                name: "Acesso Vitalício",
                quantity: 1,
                price: numericAmount
            }
        ];
    }

    console.log("--> [CARTÃO] Enviando para:", endpoint);

    // 5. Envia para a Neon
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': secretKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("--> [CARTÃO] Erro Neon:", JSON.stringify(data, null, 2));
        return res.status(response.status).json({
            erro: "TRANSACAO_NEGADA",
            mensagem: data.message || "Pagamento não autorizado.",
            detalhes: data
        });
    }

    console.log("--> [CARTÃO] Sucesso! ID:", data.transactionId);
    return res.status(200).json(data);

  } catch (error) {
    console.error("--> [CARTÃO] Erro Crítico:", error);
    return res.status(500).json({ erro: "INTERNAL_ERROR", mensagem: error.message });
  }
}
