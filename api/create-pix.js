// api/create-pix.js
export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-public-key, x-secret-key'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log("--> [API] Iniciando processamento Pix...");

    // CARREGA AS CHAVES DO AMBIENTE SEGURO (VERCEL)
    const publicKey = process.env.NEON_PUBLIC_KEY;
    const secretKey = process.env.NEON_SECRET_KEY;

    if (!publicKey || !secretKey) {
        console.error("ERRO: Chaves NEON não configuradas no painel da Vercel.");
        return res.status(500).json({ erro: "CONFIG_ERROR", mensagem: "Erro de configuração no servidor." });
    }

    let bodyData = req.body;
    if (typeof bodyData === 'string') bodyData = JSON.parse(bodyData);

    const url = 'https://app.neonpay.com.br/api/v1/gateway/pix/receive';
    
    // Envia para a Neon
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': secretKey
      },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("--> [API] Erro Neon:", JSON.stringify(data, null, 2));
    } else {
        console.log("--> [API] Pix gerado com sucesso (200 OK)");
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("--> [API] Erro Crítico:", error);
    return res.status(500).json({ erro: "INTERNAL_ERROR", mensagem: error.message });
  }
}
