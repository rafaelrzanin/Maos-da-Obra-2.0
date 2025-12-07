// api/create-pix.js
// Usando formato CommonJS para evitar erros de sintaxe na Vercel

module.exports = async (req, res) => {
  // 1. Configurar cabeçalhos de segurança (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Se for uma "pergunta" do navegador (OPTIONS), responde que pode passar
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Tentar ler a chave (agora com logs)
    const apiKey = process.env.NEON_SECRET_KEY || process.env.VITE_NEON_SECRET_KEY;
    
    console.log("--> Iniciando rota API Pix...");
    
    if (!apiKey) {
      console.error("ERRO FATAL: Nenhuma chave API encontrada no servidor.");
      // Retorna erro explicativo
      return res.status(500).json({ 
        erro: "CONFIGURAÇÃO_FALTANTE",
        mensagem: "A chave NEON_SECRET_KEY não está configurada nas variáveis de ambiente da Vercel." 
      });
    }

    console.log("--> Chave encontrada. Enviando requisição para Neon...");

    // 3. Fazer o pedido para a Neon
    // Nota: Em Node.js antigo precisa de 'node-fetch', mas Vercel atual já suporta fetch nativo.
    const response = await fetch('https://app.neonpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(req.body)
    });

    // Lê a resposta do banco
    const data = await response.json();
    console.log("--> Resposta da Neon:", response.status);

    // Devolve para o site exatamente o que o banco respondeu
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("--> Erro no código do servidor:", error);
    return res.status(500).json({ 
      erro: "ERRO_INTERNO", 
      mensagem: error.message 
    });
  }
};
