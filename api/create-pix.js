O erro 401 persiste. O Backend não está lendo a variável de ambiente.

Por favor, reescreva o arquivo `api/create-pix.js` com uma VERIFICAÇÃO DE SEGURANÇA no início.

O código deve ser assim:

export default async function handler(req, res) {
  // 1. Configurar CORS para aceitar seu site
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Tratamento para o navegador perguntando se pode conectar (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Tentar ler a chave de todas as formas possíveis
  const apiKey = process.env.NEON_SECRET_KEY || process.env.VITE_NEON_SECRET_KEY;

  console.log("Tentando iniciar Pix...");
  console.log("Chave existe?", !!apiKey); // Isso vai pro log da Vercel

  // 3. SE NÃO TIVER CHAVE, PARE AQUI
  if (!apiKey) {
    return res.status(500).json({ 
      error: "ERRO DE CONFIGURAÇÃO: A variável NEON_SECRET_KEY não foi encontrada no servidor." 
    });
  }

  try {
    // 4. Faz a chamada para a Neon
    const response = await fetch('https://app.neonpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      // Repassa o erro exato do banco
      return res.status(response.status).json(data);
    }

    // Sucesso
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
