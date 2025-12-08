// api/create-card.js
export default async function handler(req, res) {
  // 1. Configuração de Segurança (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-public-key, x-secret-key'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log("--> [CARTÃO] Iniciando processamento...");

    // 2. Carrega as chaves da Vercel
    const publicKey = process.env.NEON_PUBLIC_KEY;
    const secretKey = process.env.NEON_SECRET_KEY;

    if (!publicKey || !secretKey) {
        return res.status(500).json({ erro: "CONFIG_ERROR", mensagem: "Chaves de API não configuradas." });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { amount, card, client, installments, planType } = body;

    // 3. Define se é Assinatura ou Pagamento Único
    // Se for VITALICIO, é pagamento único. Se for MENSAL ou SEMESTRAL, é assinatura.
    const isSubscription = planType === 'MENSAL' || planType === 'SEMESTRAL';
    
    // URL base da Neon
    const baseUrl = 'https://app.neonpay.com.br'; 
    // endpoint muda dependendo do tipo
    const endpoint = isSubscription ? '/gateway/card/subscription' : '/gateway/card/receive';
    
    console.log(`--> [CARTÃO] Modo: ${isSubscription ? 'ASSINATURA' : 'PAGAMENTO ÚNICO'}`);

    // 4. Monta o Payload (Dados) conforme a documentação
    let payload = {
        identifier: body.identifier || `txn_${Date.now()}`,
        amount: parseFloat(amount), // A Neon pede number (ex: 29.90)
        clientIp: "127.0.0.1", // Em produção, idealmente pegar o IP real do req.headers['x-forwarded-for']
        client: {
            name: client.name,
            email: client.email,
            phone: client.phone,
            document: client.document,
            address: { // Endereço obrigatório segundo doc (usando dados fictícios se não tiver no form)
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
            owner: card.holder,
            expiresAt: card.expiry.replace('/', '-20'), // De "12/25" para "12-2025" (ajustar conforme necessidade da Neon, doc diz YYYY-MM ou similar)
            cvv: card.cvv
        }
    };

    // Ajustes específicos para cada tipo
    if (isSubscription) {
        // --- LOGICA DE ASSINATURA ---
        payload.subscription = {
            periodicityType: "MONTHS",
            periodicity: planType === 'SEMESTRAL' ? 6 : 1, // 1 mês ou 6 meses
            firstChargeIn: 0 // Cobra agora
        };
        // Na assinatura, 'product' é um objeto
        payload.product = {
            id: planType.toLowerCase(),
            name: `Plano ${planType}`,
            quantity: 1,
            price: parseFloat(amount)
        };
    } else {
        // --- LOGICA DE PAGAMENTO ÚNICO ---
        payload.installments = parseInt(installments || 1);
        // No pagamento único, 'products' é um array
        payload.products = [
            {
                id: "vitalicio",
                name: "Acesso Vitalício",
                quantity: 1,
                price: parseFloat(amount)
            }
        ];
    }

    // Corrige a data de validade para o formato da Neon se necessário
    // Doc diz: expiresAt no objeto card. Geralmente gateways aceitam "2025-12" ou "12/2025"
    // Vamos garantir o formato YYYY-MM que estava no exemplo: "2025-12"
    const [mes, anoCurto] = card.expiry.split('/');
    payload.card.expiresAt = `20${anoCurto}-${mes}`;

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
