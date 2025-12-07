export default async function handler(req, res) {
  // 1. Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  console.log("--- INICIANDO PROXY API PIX (V3 - NEON_SECRET_KEY) ---");

  try {
    // 2. Leitura da Chave de API (Sem prefixo VITE)
    const apiKey = process.env.NEON_SECRET_KEY;
    
    // Verificação de segurança rigorosa
    if (!apiKey) {
         console.error("ERRO CRÍTICO: NEON_SECRET_KEY está undefined.");
         throw new Error("A chave NEON_SECRET_KEY não foi encontrada no servidor.");
    }

    console.log("Debug: Chave API detectada. Tamanho:", apiKey.length);

    // 3. Parse seguro do Body
    let payload = req.body;
    
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            console.error("Erro no parse do JSON:", e);
            return res.status(400).json({ error: 'Invalid JSON body', details: e.message });
        }
    }

    console.log("Debug: Enviando Payload para Neon...");

    // 4. Chamada para a API da Neon
    const neonUrl = "https://app.neonpay.com.br/api/v1/gateway/pix/receive";
    
    const response = await fetch(neonUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}` // Usando a chave lida do process.env
      },
      body: JSON.stringify(payload)
    });

    // 5. Tratamento de Resposta
    const responseText = await response.text();
    
    console.log(`Debug: Resposta Neon Status: ${response.status}`);
    
    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        // Se a resposta não for JSON (ex: erro HTML do gateway), retornamos o texto cru
        responseData = { 
            error: "Invalid JSON response from Neon", 
            raw_response: responseText 
        };
    }

    // Repassa o status e o body exatamente como veio
    return res.status(response.status).json(responseData);

  } catch (error) {
    console.error("ERRO INTERNO NO PROXY:", error);
    return res.status(500).json({ 
        error: "Internal Server Error", 
        message: error.message 
    });
  }
}
