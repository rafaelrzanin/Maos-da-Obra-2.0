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
    console.log("--> [API] Iniciando com Autenticação Dupla (Docs)...");

    // ============================================================
    // COLE SUAS CHAVES AQUI (DENTRO DAS ASPAS):
    // ============================================================
    const publicKey = "rafaelzanin_tcy9tsl2402e90an"; 
    const secretKey = "qrmhhjnlrugspa070mv7u63n1999m7pb9i4h48vdc62y9ufbd7ajrxxsfj815ng8";
    // ============================================================

    let bodyData = req.body;
    if (typeof bodyData === 'string') bodyData = JSON.parse(bodyData);

    const url = 'https://app.neonpay.com.br/api/v1/gateway/pix/receive';
    
    console.log(`--> Enviando para: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // HEADER OFICIAL CONFORME DOCUMENTAÇÃO:
        'x-public-key': publicKey,
        'x-secret-key': secretKey
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
