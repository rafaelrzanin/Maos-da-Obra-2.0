export default async function handler(req, res) {
  // 1. Configuração de CORS (Permitir acesso do Frontend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Responder a preflight requests imediatamente
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Apenas método POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  console.log("--- INICIANDO PROXY API PIX ---");

  // 2. Verificação da Chave de API
  // Nota: Na Vercel, Environment Variables são acessadas via process.env
  const apiKey = process.env.VITE_NEON_SECRET_KEY;
  
  console.log("Debug: Verificando Chave de API...");
  console.log("API Key existe?", !!apiKey); // Log seguro (true/false)
  if (apiKey) {
      console.log("API Key tamanho:", apiKey.length);
      console.log("API Key prefixo:", apiKey.substring(0, 5) + "...");
  } else {
      console.error("ERRO CRÍTICO: VITE_NEON_SECRET_KEY está undefined no ambiente do servidor.");
      return res.status(500).json({ 
          error: 'Server Configuration Error', 
          message: 'A chave de API (VITE_NEON_SECRET_KEY) não foi encontrada nas variáveis de ambiente da Vercel.' 
      });
  }

  try {
    // 3. Parse seguro do Body
    let payload = req.body;
    
    // Se o body vier como string (alguns clients enviam assim), fazemos parse manual
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            console.error("Erro ao fazer parse do body JSON:", e);
            return res.status(400).json({ error: 'Invalid JSON body', details: e.message });
        }
    }

    console.log("Debug: Enviando Payload para Neon:");
    console.log(JSON.stringify(payload, null, 2));

    // 4. Chamada para a API da Neon
    const neonUrl = "https://app.neonpay.com.br/api/v1/gateway/pix/receive";
    
    const response = await fetch(neonUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    // 5. Tratamento de Resposta (Sucesso ou Erro)
    // Lemos como texto primeiro para evitar crash se a API retornar HTML (ex: erro de gateway)
    const responseText = await response.text();
    
    console.log(`Debug: Resposta Neon Status: ${response.status}`);
    console.log("Debug: Resposta Neon Body:", responseText);

    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        // Se não for JSON válido, retornamos o texto cru dentro de um objeto
        responseData = { raw_response: responseText, note: "A resposta da Neon não era um JSON válido." };
    }

    // Repassa o status code exato e o corpo exato para o frontend
    return res.status(response.status).json(responseData);

  } catch (error) {
    console.error("ERRO INTERNO NO PROXY:", error);
    return res.status(500).json({ 
        error: "Internal Server Error in Proxy", 
        message: error.message,
        stack: error.stack 
    });
  }
}
