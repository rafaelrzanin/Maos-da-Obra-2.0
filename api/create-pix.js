export default async function handler(req, res) {
  // Configuração de CORS para a Serverless Function (permitir chamadas do próprio domínio)
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

  // Captura os dados enviados pelo frontend
  const { amount, client, identifier } = req.body;
  
  // Acessa a chave secreta do ambiente (Server-side)
  // Certifique-se de que VITE_NEON_SECRET_KEY está definida nas Environment Variables da Vercel
  const apiKey = process.env.VITE_NEON_SECRET_KEY;

  if (!apiKey) {
    console.error("ERRO: Chave VITE_NEON_SECRET_KEY não encontrada no servidor.");
    return res.status(500).json({ error: 'Configuration Error: Missing API Key' });
  }

  try {
    // Chama a API da Neon (Server-to-Server, sem bloqueio de CORS)
    const response = await fetch("https://app.neonpay.com.br/api/v1/gateway/pix/receive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}` // Autenticação segura aqui
      },
      body: JSON.stringify({
        amount,
        client,
        identifier
      })
    });

    const data = await response.json();

    // Repassa o status e o corpo da resposta original
    if (!response.ok) {
      console.error("Erro na resposta da Neon:", data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro interno no Proxy Pix:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
