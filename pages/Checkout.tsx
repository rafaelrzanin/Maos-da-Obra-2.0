// ESTA FUNÇÃO DEVE SER ATUALIZADA NO SEU FICHEIRO Checkout.tsx

const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDetails || !user) return; // Garante que user exista
    setErrorMsg('');
    setProcessing(true);
    try {
        const cleanNumber = cardData.number.replace(/\s/g, '');
        if (cleanNumber.length < 16) throw new Error("Número do cartão inválido");
        if (cardData.cvv.length < 3) throw new Error("CVV inválido");

        // --- CORREÇÃO: Cria o objeto client com o 'document' (CPF) ---
        const clientPayload = {
            name: user.name,
            email: user.email,
            phone: user.phone,
            // GARANTINDO que o campo 'document' seja enviado. 
            // O valor deve vir do campo 'cpf' do objeto user (armazenado no localStorage).
            document: user.cpf, 
        };
        // -------------------------------------------------------------

        const response = await fetch('/api/create-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: planDetails.price,
                installments: cardData.installments,
                planType: planDetails.type,
                card: { ...cardData, number: cleanNumber },
                client: clientPayload // Envia o payload corrigido
            })
        });
        
        // ... restante do código de erro e sucesso
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Transação recusada.");

        // SUCESSO REAL (Cartão): Redireciona para o App
        redirectToDashboard();

    } catch (err: any) {
        setErrorMsg(err.message || "Erro ao processar cartão.");
    } finally { setProcessing(false); }
};
