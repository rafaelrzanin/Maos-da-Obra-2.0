import { useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Lock, HardHat } from 'lucide-react';

export default function Success() {
  // REMOVIDO: const navigate = useNavigate(); (Era a causa do erro)
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email'); // Pega o email da URL

  const handleAccessApp = () => {
    // Usamos window.location.href para garantir a saída do App Quiz e a entrada no App principal
    window.location.href = "https://app.maosdaobra.com.br/dashboard"; 
  };

  return (
    <div className="min-h-screen bg-[#172134] flex items-center justify-center p-4 font-sans selection:bg-[#bc5a08] selection:text-white relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#bc5a08]/10 blur-[100px]"></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        
        {/* Header / Logo */}
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#bc5a08] rounded-2xl shadow-lg shadow-orange-900/20 transform rotate-6 mb-6 mx-auto">
                <HardHat className="text-white w-9 h-9 transform -rotate-6" strokeWidth={2.5} />
            </div>
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
            
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Assinatura Ativa!</h1>
            <p className="text-gray-400 mb-8">O pagamento foi confirmado. Bem-vindo(a) à plataforma.</p>

            <div className="bg-[#0F172A] p-4 rounded-xl text-left mb-8 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Seus Dados de Acesso</p>
                <p className="text-sm text-gray-300 mb-1">E-mail: <span className="text-white font-bold">{email || 'Não informado'}</span></p>
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-[#bc5a08] flex items-center gap-2 font-medium">
                        <Lock size={12} /> Sua senha é a que você criou na tela anterior.
                    </p>
                </div>
            </div>

            <button 
              onClick={handleAccessApp}
              className="w-full bg-[#bc5a08] hover:bg-[#a64e07] text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 transform active:scale-[0.98]"
            >
              ACESSAR O APP AGORA
              <ArrowRight size={20} />
            </button>
            
            <p className="text-xs text-gray-500 mt-4">Redirecionando em instantes...</p>
        </div>
      </div>
    </div>
  );
}
