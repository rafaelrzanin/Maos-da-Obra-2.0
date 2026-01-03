
import React from 'react';
import { LIFETIME_BONUSES } from '../services/standards.ts'; 

const VideoTutorials = () => {
  const videos = [
    {
      id: 'video1',
      title: 'Primeiros Passos no App',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder YouTube embed URL
      description: 'Aprenda a configurar sua primeira obra, adicionar etapas e materiais.',
    },
    {
      id: 'video2',
      title: 'Gerenciando Gastos e Financeiro',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder YouTube embed URL
      description: 'Como registrar despesas, acompanhar o orçamento e gerar relatórios financeiros.',
    },
    {
      id: 'video3',
      title: 'Funcionalidades da IA Zé da Obra',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder YouTube embed URL
      description: 'Explore como o Zé da Obra AI pode te ajudar com dicas, cálculos e conselhos inteligentes.',
    },
    // Add more videos as needed
  ];

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-4 font-sans animate-in fade-in">
      <h1 className="text-3xl font-black text-primary dark:text-white mb-6 tracking-tight">Tutoriais em Vídeo</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-8">
        Aprenda a usar todas as funcionalidades do Mãos da Obra com nossos guias em vídeo.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {videos.map(video => (
          <div key={video.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-primary dark:text-white mb-3">{video.title}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{video.description}</p>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-4">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={video.url}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <a 
              href={video.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors"
            >
              <i className="fa-solid fa-play-circle mr-2"></i> Assistir no YouTube
            </a>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-black text-primary dark:text-white mb-4 tracking-tight">Bônus Vitalícios</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-6">
          Conheça as ferramentas exclusivas disponíveis apenas no plano Vitalício.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {LIFETIME_BONUSES.map((bonus, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-card-dark-subtle">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 flex items-center justify-center shrink-0">
                        <i className={`fa-solid ${bonus.icon}`}></i>
                    </div>
                    <div>
                        <h4 className="font-bold text-primary dark:text-white text-base">{bonus.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{bonus.desc}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default VideoTutorials;
