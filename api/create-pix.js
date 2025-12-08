// api/create-pix.js
// Agora usando a sintaxe "export default" (ES Modules) para compatibilidade total

export default async function handler(req, res) {
  // 1. Configurar cabeçalhos de segurança (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Se for uma verificação do navegador (OPTIONS), responde OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Tenta pegar a chave de API das variáveis de ambiente
    const apiKey = process.env.NEON_SECRET_KEY || process.env.VITE_NEON_SECRET_KEY;
    
    console.log("--> Iniciando rota API Pix...");

    if (!apiKey) {
      console.error("ERRO FATAL: Chave API ausente.");
      return res.status(500).json({ erro: "CONFIGURAÇÃO", mensagem: "Chave API não configurada na Vercel." });
    }

    // 2. Tratamento do Body (Segurança contra formato inválido)
    let bodyData = req.body;
    
    // As vezes o body chega como string na Vercel, aqui garantimos que vira Objeto
    if (typeof bodyData === 'string') {
        try {
            bodyData = JSON.parse(bodyData);
        } catch (e) {
            console.error("Erro ao fazer parse do body:", e);
            return res.status(400).json({ erro: "JSON_INVALIDO", mensagem: "O corpo da requisição não é um JSON válido." });
        }
    }

    console.log("--> Enviando requisição para Neon Pay...");

    // 3. Fazer o pedido para a Neon
    const response = await fetch('https://app.neonpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(bodyData)
    });

    // 4. Tratamento Seguro da Resposta
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
        // Se a resposta for JSON, repassa para o Front-end
        const data = await response.json();
        console.log("--> Resposta Neon (JSON):", response.status);
        
        if (!response.ok) {
            console.error("Erro retornado pela Neon:", data);
        }
        return res.status(response.status).json(data);
    } else {
        // Se a resposta NÃO for JSON (erro grave, HTML, etc)
        const text = await response.text();
        console.error("--> Erro Crítico Neon (Não-JSON):", text);
        return res.status(502).json({ 
            erro: "ERRO_GATEWAY", 
            mensagem: "A Neon retornou uma resposta inválida.",
            detalhes: text.substring(0, 150) // Mostra só o começo do erro
        });
    }

  } catch (error) {
    console.error("--> Erro CRÍTICO no servidor:", error);
    return res.status(500).json({ 
      erro: "ERRO_INTERNO", 
      mensagem: error.message 
    });
  }
}
