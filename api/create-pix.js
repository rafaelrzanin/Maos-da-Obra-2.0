// api/create-pix.js
// Vercel Serverless Function (ES Modules)

export default async function handler(req, res) {
  // 1. Configurar CORS (Permite que seu site fale com a API)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Responde rápido para pre-flight requests do navegador
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log("--> [API] Iniciando processamento...");

    // 2. Carrega a Chave API
    const apiKey = process.env.NEON_SECRET_KEY;
    
    // DEBUG: Mostra no log se a chave foi lida (sem vazar a senha toda)
    if (apiKey) {
        console.log(`--> [API] Chave carregada: ${apiKey.substring(0, 4)}... (Ok)`);
    } else {
        console.error("--> [API] ERRO: Nenhuma chave NEON_SECRET_KEY encontrada!");
        // Retorna erro amigável para o front-end não ficar em loading eterno
        return res.status(500).json({ 
            erro: "CONFIG_MISSING", 
            mensagem: "A chave API não está configurada no servidor." 
        });
    }

    // 3. Lê o corpo do pedido
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
        bodyData = JSON.parse(bodyData);
    }

    console.log("--> [API] Enviando para Neon Pay...");

    // 4. Chama a Neon
    const response = await fetch('https://app.neonpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey // Autenticação Bearer Padrão
      },
      body: JSON.stringify(bodyData)
    });

    // 5. Devolve a resposta
    const data = await response.json();
    console.log("--> [API] Resposta Neon HTTP:", response.status);

    // Se a Neon recusou (401/400), loga o erro no console da Vercel
    if (!response.ok) {
        console.error("--> [API] Erro da Neon:", JSON.stringify(data, null, 2));
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("--> [API] Erro Crítico:", error);
    return res.status(500).json({ 
        erro: "INTERNAL_ERROR", 
        mensagem: error.message 
    });
  }
}
