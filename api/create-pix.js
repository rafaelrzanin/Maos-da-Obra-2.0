// api/create-pix.js
export default async function handler(req, res) {
  // Configuração CORS Padrão
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Token, x-api-key'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    console.log("--> [API] Iniciando tentativa com URL correta...");

    // 1. SUA CHAVE AQUI (Mantenha Hardcoded para testar)
    // Se a chave não funcionar aqui, ela está inválida ou expirada.
    const apiKey = "qrmhhjnlrugspa070mv7u63n1999m7pb9i4h48vdc62y9ufbd7ajrxxsfj815ng8"; 

    // Tratamento do Body
    let bodyData = req.body;
    if (typeof bodyData === 'string') bodyData = JSON.parse(bodyData);

    // 2. CORREÇÃO DA URL (De 'app' para 'api')
    const url = 'https://api.neonpay.com.br/v1/gateway/pix/receive';
    
    console.log(`--> Enviando para: ${url}`);

    // 3. ESTRATÉGIA "SHOTGUN" (Envia a chave em todos os lugares possíveis)
    // Assim não tem como o Gateway dizer que não viu.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Tenta com Bearer
        'Authorization': `Bearer ${apiKey}`,
        // Tenta em headers alternativos que gateways costumam usar
        'x-api-key': apiKey,
        'Token': apiKey
      },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();
    console.log("--> [API] Status:", response.status);

    if (!response.ok) {
        // Log detalhado do erro
        console.error("--> [API] Erro detalhado:", JSON.stringify(data, null, 2));
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("--> [API] Erro Crítico:", error);
    return res.status(500).json({ erro: "INTERNAL_ERROR", mensagem: error.message });
  }
}
