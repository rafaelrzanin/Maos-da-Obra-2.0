// api/create-pix.js
export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log("--> [API] Iniciando com Basic Auth...");

    // 1. SUA CHAVE AQUI (Mantenha Hardcoded para o teste final)
    const apiKey = "qrmhhjnlrugspa070mv7u63n1999m7pb9i4h48vdc62y9ufbd7ajrxxsfj815ng8"; 

    // 2. CODIFICAÇÃO PARA BASIC AUTH
    // O padrão é "Basic <base64(chave:)>" (Note os dois pontos no final da chave)
    const basicAuth = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');

    let bodyData = req.body;
    if (typeof bodyData === 'string') bodyData = JSON.parse(bodyData);

    // 3. URL CORRETA (A que respondeu 401 antes)
    const url = 'https://app.neonpay.com.br/api/v1/gateway/pix/receive';
    
    console.log(`--> Enviando para: ${url}`);
    console.log(`--> Header Auth: ${basicAuth.substring(0, 20)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth // <--- Aqui está o segredo
      },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();
    console.log("--> [API] Status:", response.status);

    if (!response.ok) {
        console.error("--> [API] Erro detalhado:", JSON.stringify(data, null, 2));
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("--> [API] Erro Crítico:", error);
    return res.status(500).json({ erro: "INTERNAL_ERROR", mensagem: error.message });
  }
}
