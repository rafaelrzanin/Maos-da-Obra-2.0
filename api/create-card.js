// NO TOPO de /api/create-card.ts
// 1. IMPORTAÇÃO E INICIALIZAÇÃO DO SUPABASE
import { createClient } from '@supabase/supabase-js'; 

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Chave de serviço Admin
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY 
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;


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

    // Garante que o Supabase e as chaves Neon estejam configuradas
    if (!supabase) {
        return res.status(500).json({ erro: "DB_CONFIG_ERROR", mensagem: "Chaves do Supabase (URL/KEY) não configuradas no servidor." });
    }
    if (!publicKey || !secretKey) {
        return res.status(500).json({ erro: "CONFIG_ERROR", mensagem: "Chaves de API (NEON_PUBLIC_KEY ou NEON_SECRET_KEY) não configuradas." });
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
    let payload: any = { 
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
                neighborhood: "Centro", 
                zipCode: "01001-000",
                street: "Rua Digital",
                number: "100"
            }
        },
        paymentMethod: { 
            type: "card", 
            card: {
                number: card.number.replace(/\s/g, ''),
                owner: cleanOwnerName, 
                expiresAt: expiresAtFormatado, 
                cvv: card.cvv
            }
        }
    };

    // Ajustes de Assinatura/Produto
    if (isSubscription) {
        payload.subscription = {
            periodicityType: "MONTHS",
            periodicity: planType.toUpperCase() === 'SEMESTRAL' ? 6 : 1, 
            firstChargeIn: 0 
        };
        payload.products = [{
            id: planType.toLowerCase(),
            name: `Plano ${planType}`,
            quantity: 1,
            price: numericAmount
        }];
    } else {
        // Pagamento Único (Vitalício)
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

    const logPayload = { ...payload, paymentMethod: { type: 'card', card: { number: card.number.substring(0, 4) + '****', cvv: '***' } } };
    console.log("--> [CARTÃO] Payload sendo enviado (Debug):", JSON.stringify(logPayload, null, 2));

    const finalUrl = `${API_BASE_URL}${subEndpoint}`;

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
        
        rawResponseText = await response.text();
        data = JSON.parse(rawResponseText);

    } catch (fetchError) {
        // Tratamento de erro de comunicação
        console.error("--> [CARTÃO] Erro de rede/JSON:", fetchError);
        return res.status(500).json({ erro: "API_COMM_ERROR", mensagem: "Falha na comunicação com o servidor Neon Pay." });
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

    // -----------------------------------------------------------
    // NOVO BLOCO CRÍTICO: SINCRONIZAÇÃO COM SUPABASE (Após Sucesso)
    // -----------------------------------------------------------
    try {
        const clientEmail = client.email; 
        const neonTxnId = data.transactionId; // ID da transação Neon Pay

        // Payload de atualização do perfil
        const updateData = {
            plan_status: 'ACTIVE', 
            plan_type: planType.toUpperCase(), 
            neon_txn_id: neonTxnId,
            updated_at: new Date().toISOString()
        };

        // 1. Tenta atualizar o perfil existente (Se o usuário já estiver na tabela profiles)
        const { error: updateError, data: updatedProfile } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('email', clientEmail)
            .select();

        if (updateError || !updatedProfile || updatedProfile.length === 0) {
             // 2. Se a atualização falhar ou não encontrar, tenta criar um novo perfil (Fallback)
             console.log(`[SUPABASE] Perfil não encontrado. Tentando criar para ${clientEmail}.`);
             const { error: insertError } = await supabase.from('profiles').insert([
                 { 
                     email: clientEmail, 
                     name: client.name,
                     cpf: client.document,
                     ...updateData // Inclui os dados do plano
                 }
             ]);

             if (insertError) {
                 console.error("--> [SUPABASE] ERRO CRÍTICO ao INSERIR perfil:", insertError);
                 // Não lançamos erro aqui, pois o cliente já pagou.
             }
        }
        
        console.log(`--> [SUPABASE] Perfil de ${clientEmail} sincronizado com ACTIVE.`);
        
    } catch (dbError) {
        console.error("--> [CARTÃO] ERRO: Falha catastrófica ao sincronizar perfil Supabase:", dbError);
    }
    // -----------------------------------------------------------


    console.log("--> [CARTÃO] Sucesso! ID:", data.transactionId);
    return res.status(200).json(data);

  } catch (error) {
    console.error("--> [CARTÃO] Erro Crítico:", error);
    return res.status(500).json({ erro: "INTERNAL_ERROR", mensagem: error.message });
  }
}
