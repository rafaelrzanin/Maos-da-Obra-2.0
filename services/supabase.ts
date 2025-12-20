<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MÃOS DA OBRA - Gestão Descomplicada</title>
    <meta name="description" content="Controle de obra para quem não entende de obra. Pare de perder dinheiro com erro e atraso.">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    
    <!-- Tailwind Configuration -->
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'],
              display: ['Space Grotesk', 'sans-serif'],
            },
            colors: {
              brand: {
                gold: '#d97706',       // Laranja Oficial (Basketball Orange)
                goldDark: '#b45309',   // Tom mais escuro para profundidade
                goldLight: '#f59e0b',  // Tom mais claro para iluminação
                dark: '#020617',       // Slate 950 (Fundo Principal)
                darkCard: '#0F172A',   // Slate 900 (Cards)
                accent: '#10B981',     // Verde Sucesso
                error: '#ef4444',      // Vermelho Vivo (Impacto Visual)
              }
            },
            animation: {
              'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
              'float': 'float 6s ease-in-out infinite',
              'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              'shine': 'shine 2s linear infinite',
              'stamp-slow': 'stampSlow 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards',
            },
            keyframes: {
              fadeInUp: {
                '0%': { opacity: '0', transform: 'translateY(30px)' },
                '100%': { opacity: '1', transform: 'translateY(0)' },
              },
              float: {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-20px)' },
              },
              shine: {
                '0%': { backgroundPosition: '200% center' },
                '100%': { backgroundPosition: '-200% center' },
              },
              stampSlow: {
                '0%': { opacity: '0', transform: 'scale(3) rotate(10deg)' },
                '100%': { opacity: '1', transform: 'scale(1) rotate(-2deg)' },
              }
            },
            backgroundImage: {
              'hero-glow': 'radial-gradient(circle at 50% 0%, rgba(217, 119, 6, 0.15) 0%, rgba(2,6,23,0) 70%)',
              'gold-gradient': 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              'glass': 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
            }
          }
        }
      }
    </script>
    
    <style>
      body {
        font-family: 'Inter', sans-serif;
        background-color: #020617;
        color: #F8FAFC;
        overflow-x: hidden;
      }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 8px; }
      ::-webkit-scrollbar-track { background: #020617; }
      ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: #d97706; }

      /* Utilities */
      .glass-panel {
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      
      .text-glow {
        text-shadow: 0 0 40px rgba(217, 119, 6, 0.5);
      }

      .btn-primary {
        background: linear-gradient(90deg, #d97706 0%, #f59e0b 100%);
        color: white;
        font-weight: 700;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(217, 119, 6, 0.3);
        position: relative;
        overflow: hidden;
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(217, 119, 6, 0.5);
      }

      .btn-primary::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        transition: 0.5s;
      }
      
      .btn-secondary {
        background: transparent;
        border: 2px solid #d97706;
        color: #d97706;
        font-weight: 700;
        transition: all 0.3s ease;
      }
      
      .btn-secondary:hover {
        background: #d97706;
        color: white;
        box-shadow: 0 0 20px rgba(217, 119, 6, 0.4);
      }
      
      /* Logo Rotation Fix */
      .logo-tilt {
        transform: rotate(6deg);
      }

      /* Carimbo Realista - Atualizado */
      .stamp-real {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 900;
        text-transform: uppercase;
        color: #ef4444; /* Vermelho Vivo */
        border: 4px solid #ef4444;
        padding: 0.4rem 1.2rem;
        border-radius: 4px;
        font-size: 1.4rem;
        line-height: 1;
        letter-spacing: 0.05em;
        white-space: nowrap;
        
        /* Efeito de falha na tinta (Texture) */
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'><filter id='noise'><feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23noise)' opacity='1'/></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'><filter id='noise'><feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23noise)' opacity='1'/></svg>");
        -webkit-mask-composite: destination-in;
        mask-composite: intersect;
        
        opacity: 0; /* Starts hidden for animation */
        transform-origin: center center;
      }
      
      /* Leve sombra interna para dar profundidade ao "carimbo" no papel */
      .stamp-real-wrapper {
        position: relative;
        display: inline-block;
      }
    </style>
</head>
<body class="antialiased selection:bg-brand-gold selection:text-white">

    <!-- HEADER / NAVBAR -->
    <header class="fixed top-0 w-full z-50 transition-all duration-300 glass-panel border-b-0">
        <div class="container mx-auto px-4 h-20 flex items-center justify-between">
            <!-- LOGO OFICIAL (Mantido) -->
            <div class="flex items-center gap-3 group cursor-pointer" onclick="window.scrollTo({ top: 0, behavior: 'smooth' })">
                <div class="w-10 h-10 bg-brand-gold rounded-xl logo-tilt flex items-center justify-center shadow-lg shadow-brand-gold/20 transition-transform group-hover:scale-110">
                    <i data-lucide="hard-hat" class="text-white w-5 h-5 fill-white/20"></i>
                </div>
                <div class="flex flex-col">
                    <span class="font-display font-bold text-lg leading-none tracking-tight text-white">MÃOS DA<br>OBRA</span>
                </div>
            </div>

            <!-- CTA Desktop -->
            <div class="hidden md:flex items-center gap-6">
                <a href="#como-funciona" class="text-gray-400 hover:text-white text-sm font-medium transition-colors">Como funciona</a>
                <a href="#ze-da-obra" class="text-gray-400 hover:text-white text-sm font-medium transition-colors">Conhecer o Zé</a>
                <button onclick="scrollToSection('precos')" class="btn-primary px-5 py-2 rounded-full text-xs uppercase tracking-wide">
                    Ver Planos
                </button>
            </div>
        </div>
    </header>

    <!-- 1) HERO SECTION - Otimizado e Equilibrado -->
    <section class="relative pt-20 pb-12 md:pt-28 md:pb-16 overflow-hidden flex items-center">
        <div class="absolute inset-0 bg-hero-glow pointer-events-none"></div>
        <div class="container mx-auto px-4 relative z-10">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
                <!-- Text Content (Left) -->
                <div class="text-center md:text-left z-20">
                    
                    <!-- Carimbo Realista com Animação Lenta -->
                    <div class="mb-6 h-16 flex items-center justify-center md:justify-start">
                        <div class="stamp-real-wrapper">
                            <div class="stamp-real animate-stamp-slow">
                                Xii… aí deu ruim.
                            </div>
                        </div>
                    </div>

                    <h1 class="font-display font-bold text-5xl md:text-6xl lg:text-7xl leading-[1.0] mb-4 tracking-tight animate-fade-in-up text-white" style="animation-delay: 0.1s">
                        Calma. <br>
                        <span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-brand-goldLight to-brand-gold">Não precisa ser assim.</span>
                    </h1>

                    <p class="text-lg md:text-xl text-gray-400 mb-2 font-light leading-relaxed animate-fade-in-up" style="animation-delay: 0.2s">
                        Tem solução pros problemas da sua obra. <br>
                        <span class="text-white font-medium">Simples. Sem termo difícil. Sem enrolação.</span>
                    </p>
                    
                    <!-- Reforço "Qualquer Fase" -->
                    <p class="text-sm md:text-base text-brand-gold font-bold mb-8 animate-fade-in-up uppercase tracking-wide" style="animation-delay: 0.25s">
                        Mesmo que sua obra já esteja atrasada ou no acabamento.
                    </p>

                    <!-- Micro-benefícios -->
                    <div class="flex flex-wrap justify-center md:justify-start gap-4 mb-8 animate-fade-in-up" style="animation-delay: 0.3s">
                        <div class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-gold"></i>
                            <span class="text-sm text-gray-300">Etapas Claras</span>
                        </div>
                        <div class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-gold"></i>
                            <span class="text-sm text-gray-300">Materiais Certos</span>
                        </div>
                        <div class="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-brand-gold"></i>
                            <span class="text-sm text-gray-300">Gastos Organizados</span>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-4 justify-center md:justify-start animate-fade-in-up" style="animation-delay: 0.35s">
                        <a href="#como-funciona" class="btn-primary px-8 py-4 rounded-xl text-lg font-bold shadow-2xl flex items-center justify-center gap-2 group w-full md:w-auto">
                            Quero parar de perder dinheiro
                            <i data-lucide="arrow-down" class="w-5 h-5 group-hover:translate-y-1 transition-transform"></i>
                        </a>
                        <a href="#ze-da-obra" class="btn-secondary px-8 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 w-full md:w-auto">
                            Ver o Zé da Obra
                        </a>
                    </div>
                </div>

                <!-- Visual (Right) - Mockup de Celular Realista -->
                <div class="w-full max-w-[300px] md:max-w-xs mx-auto relative animate-fade-in-up" style="animation-delay: 0.4s">
                    <!-- Phone Frame -->
                    <div class="relative z-10 mx-auto border-gray-800 bg-gray-800 border-[8px] rounded-[2.5rem] h-[580px] w-full shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
                        <div class="h-[32px] w-[3px] bg-gray-800 absolute -left-[10px] top-[72px] rounded-l-lg"></div>
                        <div class="h-[46px] w-[3px] bg-gray-800 absolute -left-[10px] top-[124px] rounded-l-lg"></div>
                        
                        <!-- Conteúdo da Tela: Placeholder Realista de App (Wireframe Style) -->
                        <div class="rounded-[2rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
                             <!-- Header do App -->
                             <div class="bg-slate-900 p-6 pt-10 pb-4">
                                 <div class="flex items-center gap-3 mb-4">
                                     <div class="w-8 h-8 rounded-full bg-slate-700"></div>
                                     <div class="h-4 w-24 bg-slate-700 rounded"></div>
                                 </div>
                                 <div class="h-8 w-32 bg-slate-700 rounded mb-2"></div>
                                 <div class="h-4 w-full bg-slate-800 rounded"></div>
                             </div>
                             
                             <!-- Lista de Itens (Simulando App Real) -->
                             <div class="flex-1 bg-slate-50 p-4 space-y-3">
                                 <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                                     <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><i data-lucide="calendar" class="w-5 h-5 text-blue-500"></i></div>
                                     <div class="flex-1">
                                         <div class="h-3 w-20 bg-slate-200 rounded mb-1"></div>
                                         <div class="h-4 w-32 bg-slate-300 rounded"></div>
                                     </div>
                                 </div>
                                 <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                                     <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><i data-lucide="package" class="w-5 h-5 text-orange-500"></i></div>
                                     <div class="flex-1">
                                         <div class="h-3 w-20 bg-slate-200 rounded mb-1"></div>
                                         <div class="h-4 w-32 bg-slate-300 rounded"></div>
                                     </div>
                                 </div>
                                 <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                                     <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><i data-lucide="dollar-sign" class="w-5 h-5 text-green-500"></i></div>
                                     <div class="flex-1">
                                         <div class="h-3 w-20 bg-slate-200 rounded mb-1"></div>
                                         <div class="h-4 w-32 bg-slate-300 rounded"></div>
                                     </div>
                                 </div>
                             </div>
                             
                             <!-- Bottom Nav -->
                             <div class="bg-white border-t p-4 flex justify-around">
                                 <div class="w-6 h-6 rounded bg-slate-200"></div>
                                 <div class="w-6 h-6 rounded bg-slate-200"></div>
                                 <div class="w-6 h-6 rounded bg-brand-gold"></div>
                             </div>

                             <!-- Overlay de brilho (vidro) -->
                             <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none"></div>
                        </div>
                    </div>
                    
                    <!-- Elementos flutuantes decorativos atrás do celular -->
                    <div class="absolute top-10 -right-4 w-24 h-24 bg-brand-gold/20 rounded-full blur-2xl"></div>
                    <div class="absolute bottom-10 -left-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
                </div>
            </div>
        </div>
    </section>

    <!-- 2) VOCÊ RECONHECE ISSO? (Dores) -->
    <section class="py-16 md:py-20 bg-brand-darkCard border-y border-white/5">
        <div class="container mx-auto px-4">
            <h2 class="text-2xl md:text-3xl font-display font-bold text-center mb-12 text-white">
                Se sua obra tá assim… <span class="text-brand-error">você não tá sozinho.</span>
            </h2>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 max-w-5xl mx-auto mb-12">
                <!-- Pain 1 -->
                <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition-colors">
                    <div class="w-12 h-12 bg-brand-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="clock" class="w-6 h-6 text-brand-error"></i>
                    </div>
                    <p class="text-gray-300 font-medium text-sm md:text-base">Atraso que não acaba</p>
                </div>

                <!-- Pain 2 -->
                <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition-colors">
                    <div class="w-12 h-12 bg-brand-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="package-x" class="w-6 h-6 text-brand-error"></i>
                    </div>
                    <p class="text-gray-300 font-medium text-sm md:text-base">Material comprado errado</p>
                </div>

                <!-- Pain 3 -->
                <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition-colors">
                    <div class="w-12 h-12 bg-brand-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="help-circle" class="w-6 h-6 text-brand-error"></i>
                    </div>
                    <p class="text-gray-300 font-medium text-sm md:text-base">Dúvida e ninguém responde</p>
                </div>

                <!-- Pain 4 -->
                <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition-colors">
                    <div class="w-12 h-12 bg-brand-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="wallet" class="w-6 h-6 text-brand-error"></i>
                    </div>
                    <p class="text-gray-300 font-medium text-sm md:text-base">Gasto que ninguém explica</p>
                </div>
            </div>
            
            <div class="text-center max-w-3xl mx-auto">
                <p class="text-xl md:text-2xl text-white font-bold leading-relaxed">
                    "O pedreiro vai embora. <span class="text-brand-error">A conta fica com você.</span>"
                </p>
                <p class="text-gray-400 mt-2">Pare de pagar caro por erros que poderiam ser evitados.</p>
            </div>
        </div>
    </section>
    
    <!-- NOVA SEÇÃO: FASES DA OBRA (VERSATILIDADE) -->
    <section class="py-20 bg-brand-dark relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
        <div class="container mx-auto px-4 relative z-10">
             <div class="text-center mb-12">
                 <h2 class="text-2xl md:text-4xl font-display font-bold text-white mb-4">
                     Não importa a fase da sua obra.
                 </h2>
                 <p class="text-gray-400 max-w-2xl mx-auto">
                     Mesmo no acabamento, uma decisão certa pode economizar 10 a 20 vezes mais do que o valor do aplicativo.
                 </p>
             </div>
             
             <div class="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                 <!-- Card Começo -->
                 <div class="bg-white/5 border border-white/10 p-6 rounded-2xl hover:border-brand-gold/50 transition-colors group">
                     <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <i data-lucide="map" class="w-6 h-6 text-blue-400"></i>
                     </div>
                     <h3 class="text-white font-bold text-lg mb-2">Vai Começar?</h3>
                     <p class="text-gray-400 text-sm">Evite o erro desde o dia 1. Comece com o cronograma certo e a lista exata do que comprar.</p>
                 </div>
                 
                 <!-- Card Meio -->
                 <div class="bg-white/5 border border-white/10 p-6 rounded-2xl hover:border-brand-gold/50 transition-colors group">
                     <div class="w-10 h-10 bg-brand-gold/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <i data-lucide="alert-triangle" class="w-6 h-6 text-brand-gold"></i>
                     </div>
                     <h3 class="text-white font-bold text-lg mb-2">Tá no meio ou atrasado?</h3>
                     <p class="text-gray-400 text-sm">Organize o caos. Descubra onde o dinheiro está vazando e coloque a obra de volta nos trilhos.</p>
                 </div>
                 
                 <!-- Card Fim -->
                 <div class="bg-white/5 border border-white/10 p-6 rounded-2xl hover:border-brand-gold/50 transition-colors group">
                     <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                         <i data-lucide="paint-bucket" class="w-6 h-6 text-green-400"></i>
                     </div>
                     <h3 class="text-white font-bold text-lg mb-2">Acabamento ou Reforma?</h3>
                     <p class="text-gray-400 text-sm">A fase mais cara. Um piso ou tinta comprado errado aqui custa 10x mais que o app.</p>
                 </div>
             </div>
        </div>
    </section>

    <!-- 3) SOLUÇÃO PARA LEIGO -->
    <section id="como-funciona" class="py-20 md:py-24 bg-brand-darkCard">
        <div class="container mx-auto px-4 max-w-4xl">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-5xl font-display font-bold text-white mb-6">
                    Controle de obra pra quem <br><span class="text-brand-gold">não entende de obra.</span>
                </h2>
                <p class="text-xl text-gray-400">
                    Você vê o que fazer agora, o que vem depois e o que precisa comprar.
                    <br><strong class="text-white">Simples, passo a passo. Do jeito que dá pra entender.</strong>
                </p>
            </div>

            <div class="grid md:grid-cols-3 gap-6">
                <div class="glass-panel p-6 rounded-2xl border-l-4 border-l-blue-500 hover:bg-white/5 transition-colors">
                    <h3 class="text-xl font-bold text-white mb-2">Etapas Claras</h3>
                    <p class="text-sm text-gray-400">O app te diz: "Agora é hora de levantar parede". Sem mistério.</p>
                </div>
                <div class="glass-panel p-6 rounded-2xl border-l-4 border-l-green-500 hover:bg-white/5 transition-colors">
                    <h3 class="text-xl font-bold text-white mb-2">Materiais Certos</h3>
                    <p class="text-sm text-gray-400">Lista pronta do que comprar para aquela etapa. Nem a mais, nem a menos.</p>
                </div>
                <div class="glass-panel p-6 rounded-2xl border-l-4 border-l-brand-gold hover:bg-white/5 transition-colors">
                    <h3 class="text-xl font-bold text-white mb-2">Gastos Organizados</h3>
                    <p class="text-sm text-gray-400">Saiba exatamente para onde foi cada centavo do seu bolso.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- 4) PROVA REAL (TELAS DO APP - REALISTAS) -->
    <section class="py-20 bg-gray-900 border-y border-white/5 overflow-hidden">
        <div class="container mx-auto px-4 text-center">
            <span class="text-brand-gold font-bold text-sm tracking-widest uppercase mb-2 block">Transparência Total</span>
            <h2 class="text-3xl font-bold text-white mb-2">Por dentro do aplicativo</h2>
            <p class="text-sm text-gray-500 mb-12">Essas telas são reais. É exatamente assim que o app funciona.</p>

            <!-- Grid de Mockups -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                
                <!-- Screen 1: Visão Geral -->
                <div class="flex flex-col items-center group">
                    <div class="relative w-full max-w-[240px] aspect-[9/18] rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl bg-white">
                         <img src="https://placehold.co/240x480/f8fafc/0f172a?text=Cronograma+Obra&font=roboto" alt="Tela Visão Geral" class="w-full h-full object-cover opacity-90">
                    </div>
                    <p class="text-white text-sm font-bold mt-4">Cronograma Simples</p>
                </div>

                <!-- Screen 2: Materiais -->
                <div class="flex flex-col items-center group">
                    <div class="relative w-full max-w-[240px] aspect-[9/18] rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl bg-white">
                         <img src="https://placehold.co/240x480/f8fafc/0f172a?text=Lista+Materiais&font=roboto" alt="Tela Lista de Compras" class="w-full h-full object-cover opacity-90">
                    </div>
                    <p class="text-white text-sm font-bold mt-4">Lista de Compras</p>
                </div>

                <!-- Screen 3: Zé -->
                <div class="flex flex-col items-center group">
                    <div class="relative w-full max-w-[240px] aspect-[9/18] rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl bg-white">
                         <img src="https://placehold.co/240x480/f8fafc/0f172a?text=Chat+com+Z%C3%A9&font=roboto" alt="Tela Chat com Zé" class="w-full h-full object-cover opacity-90">
                    </div>
                    <p class="text-white text-sm font-bold mt-4">Ajuda na Hora</p>
                </div>

                <!-- Screen 4: Financeiro -->
                <div class="flex flex-col items-center group">
                    <div class="relative w-full max-w-[240px] aspect-[9/18] rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl bg-white">
                         <img src="https://placehold.co/240x480/f8fafc/0f172a?text=Gastos+Obra&font=roboto" alt="Tela Financeira" class="w-full h-full object-cover opacity-90">
                    </div>
                    <p class="text-white text-sm font-bold mt-4">Controle de Gastos</p>
                </div>

            </div>
        </div>
    </section>

    <!-- 5) ZÉ DA OBRA (HUMANIZADO) -->
    <section id="ze-da-obra" class="py-24 relative overflow-hidden bg-brand-darkCard">
        <div class="container mx-auto px-4">
            <div class="flex flex-col md:flex-row items-center gap-12 max-w-5xl mx-auto">
                
                <!-- Visual (Avatar Grande) -->
                <div class="w-full md:w-1/3 flex justify-center">
                    <div class="relative">
                        <div class="absolute inset-0 bg-brand-gold blur-[60px] opacity-30"></div>
                        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Construction%20Worker.png" class="w-48 h-48 md:w-64 md:h-64 object-contain relative z-10 animate-float">
                    </div>
                </div>

                <!-- Copy -->
                <div class="flex-1 text-center md:text-left">
                    <h2 class="text-3xl md:text-5xl font-display font-bold mb-6 text-white">Antes de gastar, <br><span class="text-brand-gold">pergunta pro Zé.</span></h2>
                    <p class="text-gray-400 text-lg mb-8">
                        Nunca mais tome uma decisão sozinho. O Zé é seu consultor 24h.
                        <br><strong>Fala simples. Responde na hora.</strong>
                        <br>Te ajuda a evitar erro bobo que custa caro.
                    </p>
                    
                    <div class="space-y-4 mb-8">
                        <div class="bg-white/5 p-4 rounded-xl rounded-bl-none text-left border border-white/10 inline-block max-w-md">
                            <p class="text-brand-gold text-xs font-bold mb-1">VOCÊ PERGUNTA:</p>
                            <p class="text-white text-sm">"Zé, o pedreiro pediu R$ 100 no metro do piso. Tá caro?"</p>
                        </div>
                        <br>
                        <div class="bg-brand-gold/10 p-4 rounded-xl rounded-br-none text-left border border-brand-gold/30 inline-block max-w-md">
                            <p class="text-brand-gold text-xs font-bold mb-1">O ZÉ RESPONDE:</p>
                            <p class="text-gray-200 text-sm">"Tá bem acima da média da sua região, que é R$ 60. Tenta negociar ou busca outro orçamento. Você economizaria uns R$ 2.000 nessa área."</p>
                        </div>
                    </div>

                    <a href="#precos" class="text-brand-gold font-bold hover:underline flex items-center justify-center md:justify-start gap-2">
                        Quero essa segurança na minha obra <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- 6) RESULTADOS LÓGICOS (MATEMÁTICA DE VALOR) -->
    <section class="py-20 bg-brand-dark">
        <div class="container mx-auto px-4 text-center">
            <h2 class="text-2xl font-bold text-white mb-12">Matemática simples: o app se paga rápido.</h2>
            
            <div class="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div class="p-6">
                    <h3 class="text-4xl font-bold text-white mb-2">1 Erro</h3>
                    <p class="text-xl text-brand-error font-medium">De piso ou revestimento custa R$ 500+</p>
                </div>
                <div class="p-6 border-y md:border-y-0 md:border-x border-white/10">
                    <h3 class="text-4xl font-bold text-white mb-2">1 Semana</h3>
                    <p class="text-xl text-brand-error font-medium">De atraso custa R$ 1.000+</p>
                </div>
                <div class="p-6">
                    <h3 class="text-4xl font-bold text-white mb-2">O App</h3>
                    <p class="text-xl text-green-400 font-medium">Custa menos que uma lata de tinta.</p>
                </div>
            </div>

            <div class="mt-12">
                <p class="text-gray-500 font-display font-bold text-lg uppercase tracking-widest">ERRAR NA OBRA CUSTA CARO.</p>
                <p class="text-gray-400 text-sm mt-1">Normalmente quem paga a conta é você.</p>
            </div>
        </div>
    </section>

    <!-- 7) COMPARAÇÃO DE VALOR (ANCORAGEM) -->
    <section class="py-24 bg-brand-gold text-brand-dark overflow-hidden relative">
        <div class="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/concrete-wall.png')] opacity-10"></div>
        <div class="container mx-auto px-4 text-center relative z-10">
            <h2 class="text-xl font-bold uppercase tracking-widest mb-4 opacity-80">Pense bem...</h2>
            <p class="text-3xl md:text-5xl font-display font-bold max-w-4xl mx-auto leading-tight">
                Resolver tudo isso custa menos do que <span class="bg-brand-dark text-brand-gold px-2">um saco de cimento.</span>
            </p>
            <p class="mt-6 text-lg font-medium opacity-80">Um erro bobo na obra custa muito mais do que isso.</p>
        </div>
    </section>

    <!-- 8) AGORA SIM: OFERTA E PLANOS -->
    <section id="precos" class="py-24 bg-brand-dark relative">
        <div class="container mx-auto px-4 relative z-10">
            
            <!-- Branding Forte -->
            <div class="text-center mb-16">
                <div class="inline-flex items-center gap-3 justify-center mb-4">
                    <div class="w-12 h-12 bg-brand-gold rounded-xl flex items-center justify-center">
                        <i data-lucide="hard-hat" class="text-white w-6 h-6"></i>
                    </div>
                    <span class="font-display font-bold text-3xl text-white">MÃOS DA OBRA</span>
                </div>
                <h2 class="text-xl text-gray-400">A sua obra na palma da sua mão.</h2>
            </div>

            <!-- Pricing Grid -->
            <div class="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
                
                <!-- PLANO MENSAL -->
                <div class="bg-white/5 rounded-3xl p-8 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all flex flex-col h-full">
                    <h3 class="text-lg font-medium text-gray-300">Mensal</h3>
                    <div class="my-4">
                        <span class="text-3xl font-bold text-white">R$ 29,90</span><span class="text-gray-500">/mês</span>
                    </div>
                    <!-- Justificativa -->
                    <div class="mb-6 text-sm font-medium text-green-400">
                        Mais barato que um saco de cimento.
                    </div>
                    
                    <!-- Bullets (Movido para cima do botão) -->
                    <div class="mt-2 space-y-3 flex-1 mb-8">
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Saiba o que fazer agora e depois</p>
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Lista de materiais certa</p>
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Controle de gastos</p>
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Gestão básica de equipe</p>
                        <div class="pt-2 border-t border-white/10">
                            <p class="text-sm text-white font-bold flex gap-2"><i data-lucide="check-circle" class="w-4 h-4 text-green-500"></i> 7 dias de Zé da Obra</p>
                        </div>
                    </div>

                    <a href="https://www.maosdaobra.online/register?plan=MENSAL" class="block w-full text-center py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition-colors font-semibold mt-auto">
                        Quero parar de perder dinheiro
                    </a>
                </div>

                <!-- PLANO SEMESTRAL -->
                <div class="bg-white/5 rounded-3xl p-8 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all flex flex-col h-full relative overflow-hidden">
                    
                    <!-- Savings Flag -->
                    <div class="absolute top-0 right-0">
                        <div class="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg tracking-wide">
                            ECONOMIA DE 46%
                        </div>
                    </div>

                    <h3 class="text-lg font-medium text-gray-300">Semestral</h3>
                    <div class="my-4">
                        <div class="flex items-baseline gap-1">
                            <span class="text-3xl font-bold text-white">R$ 16,16</span>
                            <span class="text-gray-500">/mês</span>
                        </div>
                        <p class="text-xs text-gray-400 mt-1">Cobrado R$ 97,00 a cada 6 meses</p>
                    </div>
                    <!-- Justificativa -->
                    <div class="mb-6 text-sm font-medium text-green-400">
                        Um erro que evita, já paga o plano.
                    </div>

                    <!-- Bullets (Movido para cima do botão) -->
                    <div class="mt-2 space-y-3 flex-1 mb-8">
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Tudo do plano mensal</p>
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Mais controle da obra</p>
                        <p class="text-sm text-gray-300 flex gap-2"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i> Relatórios organizados</p>
                        <div class="pt-2 border-t border-white/10">
                            <p class="text-sm text-white font-bold flex gap-2"><i data-lucide="check-circle" class="w-4 h-4 text-green-500"></i> 7 dias de Zé da Obra</p>
                        </div>
                    </div>

                    <a href="https://maosdaobra.online/register?plan=SEMESTRAL" class="block w-full text-center py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition-colors font-semibold mt-auto">
                        Estancar prejuízo agora
                    </a>
                </div>

                <!-- PLANO VITALÍCIO (Hero) -->
                <div class="bg-gradient-to-b from-gray-900 to-black rounded-[2rem] p-8 border-2 border-brand-gold shadow-[0_0_50px_rgba(217,119,6,0.3)] relative transform md:scale-110 z-20 flex flex-col h-full">
                    <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-gold text-brand-dark px-6 py-2 rounded-full font-bold text-sm shadow-lg tracking-wider uppercase flex items-center gap-2 whitespace-nowrap">
                        <i data-lucide="crown" class="w-4 h-4 fill-brand-dark"></i> Oferta Limitada
                    </div>

                    <h3 class="text-xl font-bold text-brand-gold text-center">ACESSO VITALÍCIO</h3>
                    <div class="my-6 text-center">
                        <span class="text-gray-500 line-through text-lg">R$ 997,00</span>
                        <div class="text-6xl font-display font-bold text-white tracking-tighter">R$ 247</div>
                        <span class="text-green-500 font-bold text-sm bg-green-500/10 px-2 py-1 rounded mt-2 inline-block">Pagamento Único (Sem mensalidade)</span>
                        <p class="text-sm text-brand-gold font-bold mt-2 opacity-90">ou em até 12x no cartão</p>
                    </div>

                    <!-- Bullets & Bonus (Movido para cima do botão) -->
                    <div class="space-y-4 flex-1 mb-6">
                        <div class="flex items-center gap-3">
                            <div class="bg-brand-gold/20 p-1.5 rounded-full"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i></div>
                            <span class="text-gray-200 font-medium">Acesso para SEMPRE</span>
                        </div>
                        <div class="flex items-center gap-3 bg-brand-gold/10 p-2 rounded-lg -mx-2">
                            <div class="bg-brand-gold p-1.5 rounded-full"><i data-lucide="star" class="w-4 h-4 text-white"></i></div>
                            <span class="text-white font-bold">Zé da Obra ILIMITADO</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="bg-brand-gold/20 p-1.5 rounded-full"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i></div>
                            <span class="text-gray-200 font-medium">Gestão Financeira Completa</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="bg-brand-gold/20 p-1.5 rounded-full"><i data-lucide="check" class="w-4 h-4 text-brand-gold"></i></div>
                            <span class="text-gray-200 font-medium">Relatórios Detalhados</span>
                        </div>
                        
                        <!-- BÔNUS -->
                        <div class="border-t border-white/10 pt-4 mt-4">
                            <p class="text-xs text-brand-gold font-bold uppercase mb-3 tracking-widest">Bônus Inclusos (Grátis):</p>
                            <div class="space-y-2">
                                <div class="flex items-start gap-2">
                                    <i data-lucide="gift" class="w-4 h-4 text-brand-gold mt-0.5"></i>
                                    <span class="text-sm text-gray-400">Checklist Anti Dor de Cabeça Pós-Obra</span>
                                </div>
                                <div class="flex items-start gap-2">
                                    <i data-lucide="gift" class="w-4 h-4 text-brand-gold mt-0.5"></i>
                                    <span class="text-sm text-gray-400">Calculadora de Materiais</span>
                                </div>
                                <div class="flex items-start gap-2">
                                    <i data-lucide="gift" class="w-4 h-4 text-brand-gold mt-0.5"></i>
                                    <span class="text-sm text-gray-400">Pack de Contratos Prontos</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <a href="https://maosdaobra.online/register?plan=VITALICIO" class="btn-primary w-full py-4 rounded-xl text-lg shadow-xl flex items-center justify-center gap-2 animate-pulse-slow mt-auto">
                        Quero destravar o controle
                        <i data-lucide="lock" class="w-5 h-5"></i>
                    </a>
                </div>
            </div>
            
            <!-- Garantia -->
            <div class="max-w-2xl mx-auto mt-20 bg-white/5 rounded-2xl p-6 border border-white/10 flex items-center gap-6">
                <div class="w-16 h-16 bg-brand-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <i data-lucide="shield-check" class="w-8 h-8 text-brand-gold"></i>
                </div>
                <div>
                    <h4 class="text-white font-bold text-lg mb-1">Garantia Blindada de 30 Dias</h4>
                    <p class="text-gray-400 text-sm leading-relaxed">Se não economizar pelo menos o valor que pagou no app no primeiro mês, devolvemos 100% do seu dinheiro. Sem perguntas.</p>
                </div>
            </div>

        </div>
    </section>

    <!-- 9) DEPOIMENTOS (ANTES E DEPOIS - PROVA REAL) -->
    <section id="depoimentos" class="py-24 bg-brand-darkCard border-y border-white/5">
        <div class="container mx-auto px-4">
            <h2 class="text-2xl md:text-4xl font-display font-bold text-center mb-16 text-white">
                Quem usa diz:
            </h2>
            
            <div class="grid md:grid-cols-3 gap-8">
                <!-- Testimonial 1 -->
                <div class="bg-brand-dark p-8 rounded-3xl border border-white/10 relative">
                    <p class="text-brand-error text-xs font-bold uppercase mb-2">ANTES:</p>
                    <p class="text-gray-500 text-sm italic mb-4">"Eu tava perdida, comprava coisa errada e o pedreiro ficava parado..."</p>
                    <div class="h-px bg-white/10 w-full mb-4"></div>
                    <p class="text-green-400 text-xs font-bold uppercase mb-2">AGORA:</p>
                    <p class="text-gray-300 italic mb-6">"O app me disse exatamente quanto piso comprar. Sobrou dinheiro pra pintar a sala e o corredor."</p>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold text-white text-xs">RM</div>
                        <p class="text-white font-bold text-sm">Ricardo M.</p>
                    </div>
                </div>

                <!-- Testimonial 2 -->
                <div class="bg-brand-dark p-8 rounded-3xl border border-brand-gold/30 relative shadow-lg">
                    <p class="text-brand-error text-xs font-bold uppercase mb-2">ANTES:</p>
                    <p class="text-gray-500 text-sm italic mb-4">"Achava que ia gastar X, gastei 2X. Fui enganada nos preços..."</p>
                    <div class="h-px bg-white/10 w-full mb-4"></div>
                    <p class="text-green-400 text-xs font-bold uppercase mb-2">AGORA:</p>
                    <p class="text-gray-300 italic mb-6">"O Zé achou tijolo por R$ 0,85 quando eu ia pagar R$ 1,20. Pagou a assinatura no primeiro dia."</p>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold text-white text-xs">AL</div>
                        <p class="text-white font-bold text-sm">Ana Luiza</p>
                    </div>
                </div>

                <!-- Testimonial 3 -->
                <div class="bg-brand-dark p-8 rounded-3xl border border-white/10 relative">
                    <p class="text-brand-error text-xs font-bold uppercase mb-2">ANTES:</p>
                    <p class="text-gray-500 text-sm italic mb-4">"Papelada sumia, eu não sabia o que tinha pago pro eletricista..."</p>
                    <div class="h-px bg-white/10 w-full mb-4"></div>
                    <p class="text-green-400 text-xs font-bold uppercase mb-2">AGORA:</p>
                    <p class="text-gray-300 italic mb-6">"Tenho o controle total financeiro. Não pago nada em duplicidade. Obra sem atraso existe!"</p>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold text-white text-xs">CJ</div>
                        <p class="text-white font-bold text-sm">Carlos Jr.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 10) FAQ (OBJEÇÕES) -->
    <section class="py-20 bg-brand-dark">
        <div class="container mx-auto px-4 max-w-3xl">
            <h2 class="text-2xl font-bold text-white mb-8 text-center">Dúvidas Comuns</h2>
            
            <div class="space-y-4">
                <!-- Nova Pergunta Trial -->
                <details class="group bg-white/5 rounded-xl border border-white/10 open:bg-white/10 transition-colors">
                    <summary class="flex cursor-pointer items-center justify-between p-4 text-white font-medium">
                        Como funciona o teste de 7 dias do Zé da Obra?
                        <i data-lucide="chevron-down" class="w-5 h-5 group-open:rotate-180 transition-transform text-brand-gold"></i>
                    </summary>
                    <div class="px-4 pb-4 text-gray-400 text-sm">
                        Nos planos Mensal e Semestral, você tem 7 dias gratuitos para usar a IA do Zé e tirar dúvidas. Após esse período, o recurso é bloqueado, ficando exclusivo do plano Vitalício.
                    </div>
                </details>

                <details class="group bg-white/5 rounded-xl border border-white/10 open:bg-white/10 transition-colors">
                    <summary class="flex cursor-pointer items-center justify-between p-4 text-white font-medium">
                        Eu preciso entender de obra pra usar?
                        <i data-lucide="chevron-down" class="w-5 h-5 group-open:rotate-180 transition-transform text-brand-gold"></i>
                    </summary>
                    <div class="px-4 pb-4 text-gray-400 text-sm">
                        Não! O app foi feito justamente para quem não entende. Ele te guia passo a passo e traduz os termos difíceis.
                    </div>
                </details>

                <details class="group bg-white/5 rounded-xl border border-white/10 open:bg-white/10 transition-colors">
                    <summary class="flex cursor-pointer items-center justify-between p-4 text-white font-medium">
                        Isso serve pra casa grande e pequena?
                        <i data-lucide="chevron-down" class="w-5 h-5 group-open:rotate-180 transition-transform text-brand-gold"></i>
                    </summary>
                    <div class="px-4 pb-4 text-gray-400 text-sm">
                        Sim, serve para desde pequenas reformas de banheiro até a construção de uma casa inteira do zero.
                    </div>
                </details>

                <details class="group bg-white/5 rounded-xl border border-white/10 open:bg-white/10 transition-colors">
                    <summary class="flex cursor-pointer items-center justify-between p-4 text-white font-medium">
                        O Zé da Obra responde que tipo de dúvida?
                        <i data-lucide="chevron-down" class="w-5 h-5 group-open:rotate-180 transition-transform text-brand-gold"></i>
                    </summary>
                    <div class="px-4 pb-4 text-gray-400 text-sm">
                        Qualquer dúvida sobre materiais, preços, procedimentos e orçamentos. É como ter um consultor experiente no bolso.
                    </div>
                </details>
                
                <details class="group bg-white/5 rounded-xl border border-white/10 open:bg-white/10 transition-colors">
                    <summary class="flex cursor-pointer items-center justify-between p-4 text-white font-medium">
                        Como acesso depois de comprar?
                        <i data-lucide="chevron-down" class="w-5 h-5 group-open:rotate-180 transition-transform text-brand-gold"></i>
                    </summary>
                    <div class="px-4 pb-4 text-gray-400 text-sm">
                        Você recebe um e-mail imediatamente com seu login e senha. Funciona no celular e no computador.
                    </div>
                </details>
            </div>
        </div>
    </section>

    <!-- FOOTER -->
    <footer class="bg-black pt-12 pb-8 border-t border-white/10 text-sm">
        <div class="container mx-auto px-4 text-center">
            
            <!-- Pre-Footer CTA -->
            <div class="mb-12">
                <h3 class="text-white text-lg font-bold mb-4">Calma. Agora dá pra controlar.</h3>
                <button onclick="scrollToSection('precos')" class="btn-primary px-8 py-3 rounded-full font-bold">Começar Agora</button>
            </div>

            <div class="flex items-center justify-center gap-3 mb-8 opacity-70">
                <div class="w-8 h-8 bg-brand-gold rounded-lg logo-tilt flex items-center justify-center">
                    <i data-lucide="hard-hat" class="w-4 h-4 text-white"></i>
                </div>
                <span class="font-bold text-white tracking-widest">MÃOS DA OBRA</span>
            </div>
            
            <div class="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto text-gray-500 mb-8 text-left md:text-center">
                <a href="#" class="hover:text-brand-gold transition-colors">Termos de Uso</a>
                <a href="#" class="hover:text-brand-gold transition-colors">Política de Privacidade</a>
                <a href="#" class="hover:text-brand-gold transition-colors">Central de Ajuda</a>
                <a href="#" class="hover:text-brand-gold transition-colors">Contato</a>
            </div>

            <p class="text-gray-600">&copy; <span id="year"></span> Mãos da Obra Tecnologia. Todos os direitos reservados.</p>
        </div>
    </footer>

    <!-- MOBILE STICKY CTA -->
    <div class="md:hidden fixed bottom-0 w-full bg-brand-darkCard border-t border-white/10 p-4 z-50 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div>
            <p class="text-white font-bold text-lg">A partir de <span class="text-brand-gold">R$ 29,90</span></p>
        </div>
        <button onclick="scrollToSection('precos')" class="btn-primary px-6 py-3 rounded-lg text-sm shadow-lg font-bold">
            Garantir Agora
        </button>
    </div>

    <!-- CHAT WIDGET -->
    <div id="chat-widget-container"></div>

    <!-- SCRIPTS -->
    <script>
        const ZE_IMAGE_SRC = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Construction%20Worker.png";
        const ZE_FALLBACK_URL = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Construction%20Worker.png";

        function getZeImage() { return ZE_IMAGE_SRC; }

        document.addEventListener('DOMContentLoaded', () => {
             document.getElementById('year').textContent = new Date().getFullYear();
             lucide.createIcons();
             
             document.querySelectorAll('.ze-avatar').forEach(img => {
                 img.onerror = function() { this.src = ZE_FALLBACK_URL; };
             });

             // Header Glass Effect on Scroll
             window.addEventListener('scroll', () => {
                 const header = document.querySelector('header');
                 if (window.scrollY > 50) {
                     header.classList.add('bg-brand-dark/90', 'shadow-2xl');
                     header.classList.remove('border-b-0');
                     header.classList.add('border-b', 'border-white/5');
                 } else {
                     header.classList.remove('bg-brand-dark/90', 'shadow-2xl', 'border-b', 'border-white/5');
                     header.classList.add('border-b-0');
                 }
             });
        });

        function scrollToSection(id) {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }

        // Chat Widget Logic
        const chatContainer = document.getElementById('chat-widget-container');
        let isChatOpen = false;
        let messages = [
             { text: "Olá! 👷‍♂️ Sou o Zé. Posso analisar seu orçamento agora?", sender: 'bot' }
        ];

        function renderChat() {
            const zeImage = getZeImage();
            
            if (!isChatOpen) {
                chatContainer.innerHTML = `
                    <button onclick="toggleChat()" class="fixed bottom-24 md:bottom-8 right-4 z-40 bg-brand-gold hover:bg-brand-goldDark text-white p-4 rounded-full shadow-[0_0_20px_rgba(217,119,6,0.5)] transition-all hover:scale-110 active:scale-95 group animate-fade-in-up border-4 border-white/10">
                        <span class="absolute top-0 right-0 flex h-3 w-3">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <i data-lucide="message-square" class="w-7 h-7 fill-current"></i>
                    </button>
                `;
            } else {
                let msgsHtml = messages.map(msg => {
                    if(msg.sender === 'user') {
                        return `<div class="flex justify-end animate-fade-in-up"><div class="bg-brand-gold text-white rounded-2xl rounded-tr-sm p-3 max-w-[85%] text-sm shadow-sm"><p>${msg.text}</p></div></div>`;
                    } else {
                        return `<div class="flex justify-start animate-fade-in-up"><div class="flex items-end gap-2 max-w-[90%]"><img src="${zeImage}" onerror="this.src='${ZE_FALLBACK_URL}'" class="w-8 h-8 rounded-full border border-gray-600 mb-1 ze-avatar bg-brand-dark/50 p-0.5 object-cover"><div class="bg-gray-800 text-gray-200 rounded-2xl rounded-tl-sm p-3 text-sm shadow-md border border-white/10"><p class="font-bold text-brand-gold mb-1 text-xs uppercase tracking-wide">Zé da Obra:</p><p>${msg.text}</p></div></div></div>`;
                    }
                }).join('');

                chatContainer.innerHTML = `
                <div class="fixed bottom-24 md:bottom-24 right-4 w-[90vw] md:w-[360px] bg-brand-darkCard rounded-3xl shadow-2xl border border-white/10 z-50 overflow-hidden flex flex-col h-[500px] animate-fade-in-up">
                    <div class="bg-gradient-to-r from-brand-gold to-brand-goldDark p-4 flex justify-between items-center shadow-md z-10">
                        <div class="flex items-center gap-3">
                            <div class="relative">
                                <img src="${zeImage}" onerror="this.src='${ZE_FALLBACK_URL}'" class="w-10 h-10 rounded-full border-2 border-white ze-avatar bg-brand-dark/50 p-1 object-cover">
                                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-brand-gold rounded-full"></div>
                            </div>
                            <div><h4 class="font-bold text-white text-sm">Zé da Obra</h4><p class="text-[10px] text-white/80 font-medium">Online agora</p></div>
                        </div>
                        <button onclick="toggleChat()" class="text-white/80 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <div id="chat-msgs" class="flex-1 bg-brand-dark p-5 space-y-4 overflow-y-auto">${msgsHtml}</div>
                    <div class="p-3 bg-brand-darkCard border-t border-white/10 flex gap-2">
                        <input type="text" id="chat-input" placeholder="Digite aqui..." class="flex-1 bg-brand-dark rounded-full h-10 px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-gold border border-white/10" onkeypress="if(event.key === 'Enter') sendUserMessage(this.value)" />
                        <button onclick="sendUserMessage(document.getElementById('chat-input').value)" class="w-10 h-10 bg-brand-gold hover:bg-brand-goldDark rounded-full flex items-center justify-center text-white transition-colors"><i data-lucide="send" class="w-4 h-4 ml-0.5"></i></button>
                    </div>
                </div>`;
                
                const msgsDiv = document.getElementById('chat-msgs');
                if(msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
                
                document.querySelectorAll('.ze-avatar').forEach(img => { img.onerror = function() { this.src = ZE_FALLBACK_URL; }; });
            }
            lucide.createIcons();
        }

        function toggleChat() {
            isChatOpen = !isChatOpen;
            renderChat();
        }

        function sendUserMessage(text) {
            if(!text.trim()) return;
            messages.push({ text: text, sender: 'user' });
            renderChat();
            setTimeout(() => {
                const response = "Para te dar essa resposta com precisão técnica e economizar seu dinheiro, eu preciso que você ative o plano Vitalício. Está com um preço incrível hoje!";
                messages.push({ text: response, sender: 'bot' });
                renderChat();
            }, 1000);
        }
        
        renderChat();
    </script>
</body>
</html>
