'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, QrCode, ShieldCheck, Loader2, CheckCircle } from 'lucide-react';

// --- MOCKS/IMPORTS (Substitua pelos seus imports reais) ---
// import { dbService } from '@/services/dbService';
// import { useAuth } from '@/hooks/useAuth';

// Mock simples para o código não quebrar se você copiar e colar agora
const dbService = {
  getUserProfile: async (id: string) => {
    // Simula delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return { cpf: '12345678900', whatsapp: '(11) 99999-9999' };
  }
};

// --- TIPAGEM ---
interface PlanDetails {
  id: string;
  name: string;
  price: number;
  type: string; // 'mensal', 'anual', 'vitalicio'
}

interface CardData {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  installments: number;
}

// --- COMPONENTE DE CONTEÚDO (Lógica Principal) ---
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Estados do Usuário e Plano
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);

  // Estados de UI e Formulário
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('card');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estado do Cartão
  const [cardData, setCardData] = useState<CardData>({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
    installments: 1
  });

  // 1. Carregar Dados Iniciais (Simulação)
  useEffect(() => {
    const loadData = async () => {
      // Pega o ID do plano da URL
      const planId = searchParams.get('plan');
      
      // AQUI: Integre com sua lógica real de Auth e Banco de Dados
      // Exemplo estático:
      setUser({ id: 'user_123', name: 'Usuário Teste', email: 'teste@email.com' });

      if (planId === 'vitalicio') {
        setPlanDetails({ id: 'vitalicio', name: 'Plano Vitalício', price: 97.00, type: 'vitalicio' });
      } else {
        setPlanDetails({ id: 'mensal', name: 'Plano Mensal', price: 29.90, type: 'mensal' });
      }

      setLoading(false);
    };

    loadData();
  }, [searchParams]);

  // Função auxiliar para atualizar o plano no banco (Stub)
  const updatePlan = async (type: string) => {
    // Chame sua API ou dbService aqui para dar o upgrade no usuário
    console.log(`Atualizando plano do usuário para: ${type}`);
    return true;
  };

  // --- SUA LÓGICA DE CARTÃO INTEGRADA AQUI ---
  const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDetails || !user) return;
    
    setErrorMsg('');
    setProcessing(true);

    try {
        // 1. Validações Básicas
        const cleanNumber = cardData.number.replace(/\s/g, '');
        if (cleanNumber.length < 16) throw new Error("Número do cartão inválido");
        if (cardData.cvv.length < 3) throw new Error("CVV inválido");
        if (!cardData.expiry.includes('/')) throw new Error("Validade inválida (MM/AA)");

        // 2. Preparar dados do Cliente
        let clientCpf = '00000000000';
        let clientPhone = '(11) 99999-9999';
        
        try {
            // Timeout de segurança para não travar a venda buscando perfil
            const timeout = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 2000));
            const profileRequest = dbService.getUserProfile(user.id);
            const profile: any = await Promise.race([profileRequest, timeout]);
            
            if (profile && profile.cpf) {
                clientCpf = profile.cpf.replace(/\D/g, '');
                clientPhone = profile.whatsapp || clientPhone;
            }
        } catch (err) {
            console.warn("Usando dados de contingência para cartão.");
        }

        // Validação/Contingência CPF (Lógica específica solicitada)
        if (clientCpf === '00000000000' || clientCpf.length !== 11) {
             // Em produção real, a Neon/Gateway pode recusar. 
             // Usamos um CPF válido de teste se for ambiente de dev ou contingência arriscada.
             clientCpf = '06266344009'; 
        }

        // 3. Chamar a API (Vercel -> Neon/Gateway)
        const response = await fetch('/api/create-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: planDetails.price,
                installments: cardData.installments,
                planType: planDetails.type,
                card: { ...cardData, number: cleanNumber }, // Envia limpo
                client: {
                    name: user.name,
                    email: user.email,
                    document: clientCpf, 
                    phone: clientPhone
                }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Erro Cartão:", result);
            throw new Error(result.mensagem || "Transação não autorizada.");
        }

        // 4. Sucesso!
        await updatePlan(planDetails.type);
        // alert("Pagamento Aprovado com Sucesso!"); // Opcional, o redirect já resolve
        router.push('/?status=success'); 

    } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Erro ao processar cartão.");
    } finally {
        setProcessing(false);
    }
  };

  // --- HANDLERS DE FORMULÁRIO ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Formatação visual simples
    let formattedValue = value;
    if (name === 'number') formattedValue = value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19);
    if (name === 'expiry') formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 5);
    if (name === 'cvv') formattedValue = value.replace(/\D/g, '').substring(0, 4);

    setCardData(prev => ({ ...prev, [name]: formattedValue }));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!planDetails) {
    return <div className="p-10 text-center">Plano não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUNA DA ESQUERDA: RESUMO */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo do Pedido</h3>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{planDetails.name}</span>
              <span className="font-bold text-gray-900">R$ {planDetails.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-4 text-xl font-bold text-blue-600">
              <span>Total</span>
              <span>R$ {planDetails.price.toFixed(2)}</span>
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
              <ShieldCheck className="w-4 h-4" />
              <span>Pagamento 100% Seguro</span>
            </div>
          </div>
        </div>

        {/* COLUNA DA DIREITA: PAGAMENTO */}
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Pagamento</h2>

            {/* Abas de Método */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-medium transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Cartão
              </button>
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-medium transition-all ${
                  paymentMethod === 'pix' 
                    ? 'border-green-600 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <QrCode className="w-5 h-5" />
                PIX
              </button>
            </div>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {errorMsg}
                </div>
            )}

            {/* FORMULÁRIO CARTÃO */}
            {paymentMethod === 'card' && (
              <form onSubmit={handleCreditCardSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Cartão</label>
                  <input
                    type="text"
                    name="number"
                    placeholder="0000 0000 0000 0000"
                    value={cardData.number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome no Cartão</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="COMO NO CARTÃO"
                    value={cardData.name}
                    onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validade</label>
                    <input
                      type="text"
                      name="expiry"
                      placeholder="MM/AA"
                      value={cardData.expiry}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                    <input
                      type="text"
                      name="cvv"
                      placeholder="123"
                      value={cardData.cvv}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parcelamento</label>
                    <select
                        name="installments"
                        value={cardData.installments}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value={1}>1x de R$ {planDetails.price.toFixed(2)} (Sem juros)</option>
                        {/* Exemplo de lógica de parcelas */}
                        <option value={2}>2x de R$ {(planDetails.price / 2).toFixed(2)}</option>
                        <option value={3}>3x de R$ {(planDetails.price / 3).toFixed(2)}</option>
                    </select>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                    </>
                  ) : (
                    <>
                        <CheckCircle className="w-5 h-5" /> Pagar R$ {planDetails.price.toFixed(2)}
                    </>
                  )}
                </button>
              </form>
            )}

            {/* MENSAGEM PIX (Placeholder) */}
            {paymentMethod === 'pix' && (
              <div className="text-center py-8 space-y-4">
                <div className="bg-gray-100 p-4 rounded-lg inline-block">
                    <QrCode className="w-32 h-32 text-gray-800 opacity-50" />
                </div>
                <p className="text-gray-600 text-sm">
                  O QR Code será gerado na próxima etapa.<br/>Pagamentos via PIX têm aprovação imediata.
                </p>
                <button 
                    onClick={() => alert('Implementar lógica do PIX aqui!')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg mt-4"
                >
                    Gerar PIX
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL (EXPORTADO) ---
// Envolvemos em Suspense para corrigir o erro de build no Vercel
export default function CheckoutPage() {
  return (
    <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-500">Carregando Checkout Segura...</p>
            </div>
        </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
