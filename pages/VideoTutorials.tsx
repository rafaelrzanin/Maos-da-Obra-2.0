import React from 'react';

const VideoTutorials: React.FC = () => {
  const videos = [
    {
      id: 'video1',
      title: 'Primeiros Passos no App',
      desc: 'Aprenda a criar sua primeira obra e configurar o perfil.',
      thumb: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop',
      duration: '5:20'
    },
    {
      id: 'video2',
      title: 'Criando um Cronograma',
      desc: 'Como definir datas e acompanhar o progresso das etapas.',
      thumb: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=600&auto=format&fit=crop',
      duration: '8:45'
    },
    {
      id: 'video3',
      title: 'Controle Financeiro',
      desc: 'Lance gastos, anexe comprovantes e evite estourar o orçamento.',
      thumb: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=600&auto=format&fit=crop',
      duration: '6:10'
    },
    {
      id: 'video4',
      title: 'Usando a IA Zé da Obra',
      desc: 'Tire dúvidas técnicas e peça ajuda ao nosso assistente virtual.',
      thumb: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=crop',
      duration: '4:30'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto pb-12 pt-4 px-4 font-sans">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xl">
            <i className="fa-brands fa-youtube"></i>
        </div>
        <h1 className="text-2xl font-bold text-text-main dark:text-white">Tutoriais em Vídeo</h1>
      </div>
      <p className="text-text-muted dark:text-slate-400 mb-8 ml-14">Aprenda a usar todas as ferramentas do Mãos da Obra.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {videos.map((vid, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer">
            <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img src={vid.thumb} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-red-600 shadow-lg scale-90 group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-play ml-1 text-xl"></i>
                    </div>
                </div>
                <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-md">
                    {vid.duration}
                </div>
            </div>
            <div className="p-5">
                <h3 className="text-lg font-bold text-primary dark:text-white mb-2 leading-tight group-hover:text-secondary transition-colors">{vid.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{vid.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-8 bg-gradient-premium rounded-3xl text-white text-center">
          <i className="fa-solid fa-headset text-4xl mb-4 text-secondary"></i>
          <h2 className="text-2xl font-bold mb-2">Ainda com dúvidas?</h2>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto">Nossa equipe de suporte está pronta para te ajudar. Se você é assinante Vitalício, acesse o grupo VIP.</p>
          <button className="bg-secondary hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95">
              Falar com Suporte
          </button>
      </div>
    </div>
  );
};

export default VideoTutorials;
