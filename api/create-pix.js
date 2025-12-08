// api/create-pix.js
module.exports = async (req, res) => {
  // 1. Configurar cabeçalhos de segurança (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = process.env.NEON_SECRET_KEY || process.env.VITE_NEON_SECRET_KEY;
    
    // LOG DE DEPURAÇÃO (Verifique isso nos logs da Vercel)
    console.log("--> Iniciando rota API Pix...");

    if (!apiKey) {
      console.error("ERRO FATAL: Chave API ausente.");
      return res.status(500).json({ erro: "CONFIGURAÇÃO", mensagem: "Chave API não configurada." });
    }

    // 2. Tratamento do Body (Correção importante)
    // As vezes o body chega como string, precisamos garantir que seja Objeto antes de enviar
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
        try {
            bodyData = JSON.parse(bodyData);
        } catch (e) {
            console.error("Erro ao fazer parse do body:", e);
            return res.status(400).json({ erro: "JSON_INVALIDO", mensagem: "O corpo da requisição não é um JSON válido." });
        }
    }

    console.log("--> Enviando para Neon Pay...");

    // 3. Fazer o pedido para a Neon
    const response = await fetch('https://app.neonpay.com.br/api/v1/gateway/pix/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // A Neon geralmente usa 'Bearer', mas verifique se não é 'Basic' ou outro.
      },
      body: JSON.stringify(bodyData)
    });

    // 4. Tratamento Seguro da Resposta (Evita o erro 500 se a Neon falhar)
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.indexOf("application/json") !== -1) {
        // Se for JSON, processa normalmente
        const data = await response.json();
        console.log("--> Resposta Neon (JSON):", response.status);
        
        // Se a Neon retornou erro (ex: 400), repassem o erro mas com status correto
        if (!response.ok) {
            console.error("Erro da Neon:", data);
        }
        return res.status(response.status).json(data);
    } else {
        // Se a Neon devolveu HTML ou Texto (Erro grave ou URL errada)
        const text = await response.text();
        console.error("--> Erro Neon (Não-JSON):", text);
        return res.status(response.status).json({ 
            erro: "ERRO_EXTERNO", 
            mensagem: "A Neon retornou uma resposta inválida (não-JSON).",
            detalhes: text.substring(0, 200) // Mostra o começo do erro para debug
        });
    }

  } catch (error) {
    console.error("--> Erro CRÍTICO no servidor:", error);
    return res.status(500).json({ 
      erro: "ERRO_INTERNO", 
      mensagem: error.message 
    });
  }
};
