export default async function handler(req, res) {
  // 1. Configuração de Segurança (CORS) - MANTIDA
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-public-key, x-secret-key'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: "METHOD_NOT_ALLOWED", mensagem: "Apenas requisições POST são permitidas para esta API." });
  }

  try {
    console.log("--> [CARTÃO] Iniciando processamento...");

    // 2. Carrega as chaves da Vercel
    const publicKey = process.env.NEON_PUBLIC_KEY;
    const secretKey = process.env.NEON_SECRET_KEY;

    if (!publicKey || !secretKey) {
        return res.status(500).json({ erro: "CONFIG_ERROR", mensagem: "Chaves de API não configuradas." });
    }
    
    const API_BASE_URL = process.env.NEON_API_BASE_URL || 'https://app.neonpay.com.br/api/v1';

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { amount, card, client, installments, planType } = body;

    // Validação de segurança
    if (!client.document || client.document.length < 11) {
        return res.status(400).json({ erro: "MISSING_CLIENT_DOCUMENT", mensagem: "Documento (CPF/CNPJ) do cliente é obrigatório." });
    }

    // Garante que amount seja number e válido
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ erro: "INVALID_AMOUNT", mensagem: "O valor do pagamento é inválido." });
    }

    // 3. Define se é Assinatura ou Pagamento Único
    const isSubscription = planType.toUpperCase() !== 'VITALICIO';
    
    // Endpoints baseados na documentação da Neon Pay
    const subEndpoint = isSubscription ? '/gateway/card/subscription' : '/gateway/card/receive';
    
    console.log(`--> [CARTÃO] Modo: ${isSubscription ? 'ASSINATURA' : 'PAGAMENTO ÚNICO'}`);

    // CORREÇÃO DE FORMATO: Expiração (MM/AA -> YYYY-MM)
    const [mes, anoCurto] = card.expiry.split('/');
    const anoCompleto = `20${anoCurto}`;
    const expiresAtFormatado = `${anoCompleto}-${mes}`;

    // CORREÇÃO DE FORMATO DO NOME DO TITULAR
    const cleanOwnerName = card.name
        .toUpperCase()
        .replace(/[^A-Z\s]/g, '')
        .substring(0, 60);

    // 4. Monta o Payload (Dados)
    let payload: any = { // Adicionado 'any' para flexibilidade de tipagem
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
                state: "SP", // Sugestão: Capturar o estado do front-end
                city: "São Paulo", // Sugestão: Capturar a cidade do front-end
                neighborhood: "Centro", 
                zipCode: "01001-000",
                street: "Rua Digital",
                number: "100"
            }
        },
        // --- NÓ CRÍTICO DE MÉTODO DE PAGAMENTO ---
        paymentMethod: { 
            type: "card", // Informa explicitamente o tipo de pagamento
            card: {
                number: card.number.replace(/\s/g, ''),
                owner: cleanOwnerName, 
                expiresAt: expiresAtFormatado, 
                cvv: card.cvv
            }
        }
        // ------------------------------------------
    };

    // Ajustes específicos para Assinatura (Subscription)
    if (isSubscription) {
        payload.subscription = {
            periodicityType: "MONTHS",
            periodicity: planType.toUpperCase() === 'SEMESTRAL' ? 6 : 1, 
            firstChargeIn: 0 
        };
        // Neon Pay exige produtos para Assinaturas
        payload.products = [{
            id: planType.toLowerCase(),
            name: `Plano ${planType}`,
            quantity: 1,
            price: numericAmount
        }];

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

    // Loga o payload que está sendo enviado (sem os dados sensíveis do cartão)
    const logPayload = { ...payload, card: { number: card.number.substring(0, 4) + '****', owner: cleanOwnerName, expiresAt: expiresAtFormatado, cvv: '***' } };
    console.log("--> [CARTÃO] Payload sendo enviado (Debug):", JSON.stringify(logPayload, null, 2));

    // URL COMPLETA para envio
    const finalUrl = `${API_BASE_URL}${subEndpoint}`;
    console.log(`--> [CARTÃO] Enviando para: ${finalUrl}`);

    let response;
    let rawResponseText = '';
    let data;

    try {
        // 5. Envia para a Neon
        response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': publicKey,
                'x-secret-key': secretKey
            },
            body: JSON.stringify(payload)
        });
        
        // Tenta ler a resposta como texto primeiro
        rawResponseText = await response.text();
        data = JSON.parse(rawResponseText);

    } catch (fetchError) {
        // Tratamento de erros de comunicação (ENOTFOUND, URL, etc.)
        if (rawResponseText.startsWith('<')) {
            console.error("--> [CARTÃO] ERRO CRÍTICO HTML/URL.");
            return res.status(500).json({ 
                erro: "API_URL_ERROR", 
                mensagem: "Falha na comunicação com o gateway de pagamento. A URL base da Neon pode estar incorreta." 
            });
        }
        throw fetchError;
    }


    if (!response.ok) {
        console.error("--> [CARTÃO] Erro Neon:", JSON.stringify(data, null, 2));
        const neonMessage = data.message || (data.details && data.details.description) || "Pagamento não autorizado. Verifique os dados do cartão.";

        return res.status(response.status).json({
            erro: "TRANSACAO_NEGADA",
            mensagem: neonMessage,
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
