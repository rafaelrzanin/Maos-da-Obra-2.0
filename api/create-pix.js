// api/create-pix.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log("--> [API] Iniciando (Tentativa Basic Auth)...");

    // --- COLOQUE SUA CHAVE AQUI DENTRO DAS ASPAS ---
    const apiKey = "qrmhhjnlrugspa070mv7u63n1999m7pb9i4h48vdc62y9ufbd7ajrxxsfj815ng8"; 
    // -----------------------------------------------

    // TRANSFORMA EM BASIC AUTH (Codifica para Base64)
    // O padrão é "Basic chave:senha". Como não tem senha, usamos "chave:"
    const basicAuth = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');

    let bodyData = req.body;
    if (typeof bodyData === 'string') bodyData = JSON.parse(bodyData);

    // LOG DE SEGURANÇA (Para conferir se o header está sendo gerado)
    console.log(`--> Header Gerado: ${basicAuth.substring(0, 15)}...`);

    const response = await fetch('https://app.neonpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth, // Tenta Basic Auth
        'x-api-key': apiKey         // Tenta Header alternativo (redundância)
      },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();
    console.log("--> [API] Status Neon:", response.status);

    if (!response.ok) {
        console.error("--> [API] Erro Neon:", JSON.stringify(data, null, 2));
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("--> [API] Erro Crítico:", error);
    return res.status(500).json({ erro: "INTERNAL_ERROR", mensagem: error.message });
  }
}
