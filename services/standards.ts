
// Standard Libraries for Construction Management

// Avatar Zé da Obra (Premium 3D-Style Vector)
// Técnica: Gradientes Radiais e Gaussian Blurs para simular renderização 3D/Clay.
// Carregamento instantâneo via Data URI.
const zeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
  <defs>
    <!-- PALETA DE CORES E GRADIENTES -->
    
    <!-- Fundo: Gradiente Deep Blue "Tech" -->
    <linearGradient id="bg_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <!-- Pele: Tom quente com iluminação -->
    <radialGradient id="skin_grad" cx="40%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#f5d0b0" /> <!-- Luz -->
      <stop offset="60%" stop-color="#e2a478" /> <!-- Base -->
      <stop offset="100%" stop-color="#c28e62" /> <!-- Sombra -->
    </radialGradient>

    <!-- Capacete: Amarelo Segurança com specularity -->
    <radialGradient id="helmet_grad" cx="30%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#fde047" /> <!-- Highlight -->
      <stop offset="50%" stop-color="#eab308" /> <!-- Base -->
      <stop offset="100%" stop-color="#a16207" /> <!-- Shadow -->
    </radialGradient>

    <!-- Camisa: Azul Obra Profissional -->
    <linearGradient id="shirt_grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>

    <!-- Barba: Grisalho Mestre -->
    <radialGradient id="beard_grad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#57534e" />
      <stop offset="100%" stop-color="#292524" />
    </radialGradient>

    <!-- Sombras de Oclusão (Suavidade) -->
    <filter id="soft_shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
      <feOffset dx="0" dy="5" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3"/>
      </feComponentTransfer>
      <feMerge> 
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/> 
      </feMerge>
    </filter>
    
    <!-- Reflexo nos olhos -->
    <filter id="eye_shine">
      <feGaussianBlur stdDeviation="1" />
    </filter>
  </defs>

  <!-- BACKGROUND CIRCULAR -->
  <circle cx="400" cy="400" r="400" fill="url(#bg_grad)" />

  <!-- CORPO (Ombros) -->
  <g transform="translate(0, 50)">
    <path d="M200 800 L 200 650 Q 200 580 280 560 L 520 560 Q 600 580 600 650 L 600 800 Z" fill="url(#shirt_grad)" />
    <!-- Gola da camisa -->
    <path d="M280 560 L 400 680 L 520 560" fill="#cbd5e1" opacity="0.3" /> <!-- Camiseta de baixo -->
    <path d="M280 560 L 400 750 L 520 560" fill="none" stroke="#0f172a" stroke-width="2" opacity="0.2" />
  </g>

  <!-- PESCOÇO -->
  <path d="M320 480 L 320 580 L 480 580 L 480 480" fill="#c28e62" />
  <ellipse cx="400" cy="580" rx="80" ry="20" fill="rgba(0,0,0,0.2)" /> <!-- Sombra projetada do queixo -->

  <!-- CABEÇA (Forma base) -->
  <g filter="url(#soft_shadow)">
      <rect x="280" y="250" width="240" height="300" rx="100" ry="100" fill="url(#skin_grad)" />
      <!-- Orelhas -->
      <ellipse cx="270" cy="420" rx="20" ry="35" fill="#e2a478" />
      <ellipse cx="530" cy="420" rx="20" ry="35" fill="#e2a478" />
  </g>

  <!-- ROSTO DETALHADO -->
  
  <!-- Barba (Estilo desenhado, não blob) -->
  <path d="M280 450 Q 280 580 400 580 Q 520 580 520 450 L 520 420 Q 500 420 490 460 Q 400 440 310 460 Q 300 420 280 420 Z" fill="url(#beard_grad)" />
  
  <!-- Boca (Sorriso confiante no meio da barba) -->
  <path d="M370 510 Q 400 530 430 510" fill="none" stroke="#1c1917" stroke-width="5" stroke-linecap="round" />

  <!-- Nariz (Volume com sombra, sem linha) -->
  <path d="M385 460 L 395 480 L 415 480" fill="rgba(160, 80, 0, 0.1)" />
  <circle cx="385" cy="470" r="12" fill="#c28e62" opacity="0.5" />
  <circle cx="415" cy="470" r="12" fill="#c28e62" opacity="0.5" />
  <circle cx="400" cy="465" r="15" fill="url(#skin_grad)" />

  <!-- OLHOS (Realistas - Estilo Pixar/Disney) -->
  <g transform="translate(0, 10)">
      <!-- Esquerdo -->
      <ellipse cx="340" cy="400" rx="25" ry="18" fill="#ffffff" />
      <circle cx="340" cy="400" r="12" fill="#4b5563" /> <!-- Iris -->
      <circle cx="340" cy="400" r="6" fill="#000000" /> <!-- Pupila -->
      <circle cx="345" cy="396" r="4" fill="white" opacity="0.8" /> <!-- Brilho -->
      
      <!-- Direito -->
      <ellipse cx="460" cy="400" rx="25" ry="18" fill="#ffffff" />
      <circle cx="460" cy="400" r="12" fill="#4b5563" />
      <circle cx="460" cy="400" r="6" fill="#000000" />
      <circle cx="465" cy="396" r="4" fill="white" opacity="0.8" />
      
      <!-- Sobrancelhas (Grossas e expressivas) -->
      <path d="M315 375 Q 340 365 365 375" fill="none" stroke="#292524" stroke-width="8" stroke-linecap="round" />
      <path d="M435 375 Q 460 365 485 375" fill="none" stroke="#292524" stroke-width="8" stroke-linecap="round" />
  </g>

  <!-- CAPACETE (O toque final de Mestre) -->
  <g filter="url(#soft_shadow)">
    <!-- Casco Principal -->
    <path d="M260 320 Q 400 150 540 320 L 550 330 L 250 330 Z" fill="url(#helmet_grad)" />
    <!-- Aba frontal -->
    <path d="M250 330 L 550 330 L 560 340 Q 400 360 240 340 Z" fill="#d97706" />
    <!-- Faixa Refletiva (Prata) -->
    <path d="M350 220 Q 400 210 450 220 L 455 240 Q 400 230 345 240 Z" fill="#e2e8f0" opacity="0.8" />
    <!-- Brilho Especular (Plástico liso) -->
    <ellipse cx="320" cy="250" rx="40" ry="20" fill="white" opacity="0.3" transform="rotate(-20 320 250)" />
  </g>

</svg>
`.trim();

// Encode SVG for URL correctly
export const ZE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(zeSvg)}`;

export interface PhaseCategory {
  category: string;
  steps: string[];
}

export const STANDARD_PHASES: PhaseCategory[] = [
  {
    category: 'Preparação',
    steps: ['Limpeza do terreno', 'Demolição', 'Retirada de entulho']
  },
  {
    category: 'Estrutura e Alvenaria',
    steps: ['Fundações', 'Levantamento de paredes', 'Lajes e Vigas', 'Telhado']
  },
  {
    category: 'Instalações',
    steps: ['Rasgo de paredes', 'Tubulação de Água/Esgoto', 'Fiação Elétrica', 'Pontos de Ar Condicionado']
  },
  {
    category: 'Acabamento Grosso',
    steps: ['Chapisco e Reboco', 'Contrapiso', 'Gesso / Forro', 'Impermeabilização']
  },
  {
    category: 'Acabamento Fino',
    steps: ['Pisos e Revestimentos', 'Azulejos', 'Marmoraria (Bancadas)', 'Esquadrias (Janelas/Portas)']
  },
  {
    category: 'Pintura e Finalização',
    steps: ['Massa Corrida e Lixamento', 'Pintura Paredes/Tetos', 'Instalação de Louças e Metais', 'Instalação de Luminárias', 'Limpeza Final']
  }
];

// --- WORK TEMPLATES ---

export interface WorkTemplate {
  id: string;
  label: string;
  icon: string;
  description: string;
  defaultDurationDays: number; 
  includedSteps: string[];
}

export const WORK_TEMPLATES: WorkTemplate[] = [
  {
    id: 'CONSTRUCAO',
    label: 'Casa inteira do zero',
    icon: 'fa-house-chimney',
    description: 'Começar do terreno vazio até a mudança.',
    defaultDurationDays: 180,
    includedSteps: [
      'Limpeza do terreno', 'Fundações', 'Levantamento de paredes', 'Lajes e Vigas', 'Telhado',
      'Tubulação de Água/Esgoto', 'Fiação Elétrica', 'Chapisco e Reboco', 'Contrapiso',
      'Pisos e Revestimentos', 'Gesso / Forro', 'Pintura Paredes/Tetos', 'Instalação de Louças e Metais'
    ]
  },
  {
    id: 'REFORMA_APTO',
    label: 'Reforma Completa (Casa/Apto)',
    icon: 'fa-house-user',
    description: 'Geral: pisos, pintura, gesso e elétrica.',
    defaultDurationDays: 60,
    includedSteps: [
      'Demolição', 'Retirada de entulho', 'Tubulação de Água/Esgoto', 'Fiação Elétrica',
      'Gesso / Forro', 'Pisos e Revestimentos', 'Azulejos', 'Pintura Paredes/Tetos', 
      'Instalação de Luminárias', 'Limpeza Final'
    ]
  },
  {
    id: 'BANHEIRO',
    label: 'Só o Banheiro',
    icon: 'fa-bath',
    description: 'Troca de piso, louças e impermeabilização.',
    defaultDurationDays: 15,
    includedSteps: [
      'Demolição', 'Tubulação de Água/Esgoto', 'Impermeabilização', 'Contrapiso', 
      'Azulejos', 'Pisos e Revestimentos', 'Gesso / Forro', 'Instalação de Louças e Metais'
    ]
  },
  {
    id: 'COZINHA',
    label: 'Só a Cozinha',
    icon: 'fa-kitchen-set',
    description: 'Azulejos, bancadas e instalações.',
    defaultDurationDays: 20,
    includedSteps: [
      'Demolição', 'Rasgo de paredes', 'Tubulação de Água/Esgoto', 'Fiação Elétrica',
      'Azulejos', 'Pisos e Revestimentos', 'Marmoraria (Bancadas)', 'Instalação de Louças e Metais'
    ]
  },
  {
    id: 'PINTURA',
    label: 'Só Pintura',
    icon: 'fa-paint-roller',
    description: 'Renovar as paredes e tetos.',
    defaultDurationDays: 10,
    includedSteps: [
      'Proteção do piso', 'Massa Corrida e Lixamento', 'Pintura Paredes/Tetos', 'Limpeza Final'
    ]
  }
];

// --- MATERIAL CALCULATORS LOGIC ---

export const CALCULATOR_LOGIC = {
  FLOOR: (area: number) => {
    const margin = 1.10; 
    return {
      tiles: Math.ceil(area * margin),
      mortar: Math.ceil((area * 4) / 20), 
      grout: Math.ceil((area * 0.3)), 
    };
  },
  WALL: (width: number, height: number) => {
    const area = width * height;
    return {
      area: area.toFixed(2),
      bricks: Math.ceil(area * 25),
      cement: Math.ceil(area * 0.15), 
      sand: Math.ceil(area * 0.02), 
    };
  },
  PAINT: (area: number) => {
    const liters = Math.ceil(area / 5);
    const cans18 = Math.floor(liters / 18);
    const remainder = liters % 18;
    const gallons36 = Math.ceil(remainder / 3.6);
    
    return {
      litersTotal: liters,
      cans18,
      gallons36,
      spackle: Math.ceil(area / 12), 
      sealer: Math.ceil(area / 40), 
    };
  },
  ESTIMATOR: (bathrooms: number, rooms: number) => {
    return {
      toilets: bathrooms,
      sinks: bathrooms + 1, 
      showers: bathrooms,
      outlets: (rooms * 5) + (bathrooms * 2) + 6, 
      switches: rooms + bathrooms + 2,
      lightPoints: rooms + bathrooms + 2
    };
  }
};

export interface MaterialCatalog {
  category: string;
  items: {name: string, unit: string}[];
}

// FULL BACKUP CATALOG 
export const FULL_MATERIAL_PACKAGES: MaterialCatalog[] = [
  {
    category: 'Fundação',
    items: [
      { name: 'Cimento CP-II', unit: 'sacos' },
      { name: 'Areia Média', unit: 'm³' },
      { name: 'Brita 1', unit: 'm³' },
      { name: 'Pedra de Mão (Rachão)', unit: 'm³' },
      { name: 'Vergalhão 3/8 (10mm)', unit: 'barras' },
      { name: 'Vergalhão 5/16 (8mm)', unit: 'barras' },
      { name: 'Estribo 4.2mm (Pronto)', unit: 'un' },
      { name: 'Arame Recozido', unit: 'kg' },
      { name: 'Tábua de Pinus (Caixaria)', unit: 'dz' },
      { name: 'Prego 17x21 (Cabeça dupla)', unit: 'kg' },
      { name: 'Impermeabilizante betuminoso', unit: 'latas' }
    ]
  },
  {
    category: 'Alvenaria',
    items: [
      { name: 'Tijolo Cerâmico 8 furos', unit: 'milheiro' },
      { name: 'Bloco de Concreto Estrutural', unit: 'un' },
      { name: 'Cimento CP-II', unit: 'sacos' },
      { name: 'Cal Hidratada (Liga)', unit: 'sacos' },
      { name: 'Areia Média', unit: 'm³' },
      { name: 'Ferro para Vergas (Cabelo)', unit: 'barras' },
      { name: 'Aditivo Plastificante', unit: 'litros' }
    ]
  },
  {
    category: 'Telhado',
    items: [
      { name: 'Telha Cerâmica/Concreto', unit: 'un' },
      { name: 'Viga de Madeira (Peroba/Garapeira)', unit: 'm' },
      { name: 'Caibros', unit: 'm' },
      { name: 'Ripas', unit: 'm' },
      { name: 'Prego de Telheiro', unit: 'kg' },
      { name: 'Manta Térmica (Subcobertura)', unit: 'rolos' },
      { name: 'Caixa D\'água', unit: 'un' }
    ]
  },
  {
    category: 'Elétrica',
    items: [
      { name: 'Eletroduto Corrugado Amarelo (Flexível)', unit: 'rolos' },
      { name: 'Caixa de Luz 4x2 (Parede)', unit: 'un' },
      { name: 'Caixa de Luz 4x4', unit: 'un' },
      { name: 'Cabo Flexível 2.5mm (Tomadas)', unit: 'rolos' },
      { name: 'Cabo Flexível 1.5mm (Iluminação)', unit: 'rolos' },
      { name: 'Cabo Flexível 6mm (Chuveiro)', unit: 'm' },
      { name: 'Disjuntor Monopolar', unit: 'un' },
      { name: 'Quadro de Distribuição', unit: 'un' },
      { name: 'Fita Isolante', unit: 'un' }
    ]
  },
  {
    category: 'Hidráulica',
    items: [
      { name: 'Tubo PVC Soldável 25mm (Água)', unit: 'barras' },
      { name: 'Tubo Esgoto 100mm', unit: 'barras' },
      { name: 'Tubo Esgoto 40mm', unit: 'barras' },
      { name: 'Joelho 90 graus 25mm', unit: 'un' },
      { name: 'Luva de correr', unit: 'un' },
      { name: 'Cola para PVC', unit: 'tubo' },
      { name: 'Registro de Gaveta (Geral)', unit: 'un' },
      { name: 'Registro de Pressão (Chuveiro)', unit: 'un' },
      { name: 'Caixa Sifonada', unit: 'un' }
    ]
  },
  {
    category: 'Acabamento',
    items: [
      { name: 'Piso / Porcelanato', unit: 'm²' },
      { name: 'Argamassa AC-II ou AC-III', unit: 'sacos' },
      { name: 'Rejunte', unit: 'kg' },
      { name: 'Espaçadores / Niveladores', unit: 'pct' },
      { name: 'Rodapé', unit: 'm' }
    ]
  },
  {
    category: 'Pintura',
    items: [
      { name: 'Lixa de Parede 120/150', unit: 'folhas' },
      { name: 'Selador Acrílico', unit: 'latas' },
      { name: 'Massa Corrida (Interna)', unit: 'latas' },
      { name: 'Tinta Acrílica Fosca/Acetinada', unit: 'latas' },
      { name: 'Rolo de Lã', unit: 'un' },
      { name: 'Pincel / Trincha', unit: 'un' },
      { name: 'Fita Crepe', unit: 'rolos' },
      { name: 'Lona Plástica (Proteção)', unit: 'm' }
    ]
  }
];

// --- FALLBACK LISTS FOR CONTACTS ---
export const STANDARD_JOB_ROLES = [
  'Pedreiro', 'Ajudante', 'Mestre de Obras', 'Pintor', 'Eletricista', 
  'Encanador', 'Gesseiro', 'Marceneiro', 'Serralheiro', 'Vidraceiro', 
  'Arquiteto', 'Engenheiro', 'Outros'
];

export const STANDARD_SUPPLIER_CATEGORIES = [
  'Material Básico', 'Elétrica', 'Hidráulica', 'Pisos e Revestimentos',
  'Tintas', 'Madeiras', 'Vidraçaria', 'Marmoraria', 'Locação de Equipamentos',
  'Caçamba', 'Outros'
];

// --- LIFETIME BONUSES ---
export interface LifetimeBonus {
    title: string;
    desc: string;
    icon: string;
}

export const LIFETIME_BONUSES: LifetimeBonus[] = [
  {
    title: 'Planilha Mestra de Orçamento',
    desc: 'Excel automatizado para controle detalhado.',
    icon: 'fa-file-excel'
  },
  {
    title: 'E-book: O Guia da Obra Sem Dor',
    desc: 'Manual completo para evitar golpes e erros.',
    icon: 'fa-book-open'
  },
  {
    title: 'Grupo VIP de Mentoria',
    desc: 'Tire dúvidas direto com engenheiros.',
    icon: 'fa-users'
  },
  {
    title: 'Checklist de Vistoria de Entrega',
    desc: 'O que olhar antes de aceitar as chaves.',
    icon: 'fa-list-check'
  }
];

// --- CONTRACT TEMPLATES ---
export const CONTRACT_TEMPLATES = [
  {
    id: 'EMPREITA',
    title: 'Contrato de Empreitada',
    description: 'Serviços gerais com valor fechado.',
    contentTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS POR EMPREITADA

CONTRATANTE: [Seu Nome], CPF: [000.000.000-00].
CONTRATADO: [Nome do Profissional], CPF: [000.000.000-00].

OBJETO DO CONTRATO:
O CONTRATADO se compromete a realizar os seguintes serviços na obra localizada em [Endereço da Obra]:
- [Descrever detalhadamente o serviço 1]
- [Descrever detalhadamente o serviço 2]

VALOR E PAGAMENTO:
O valor total ajustado é de R$ [0,00].
O pagamento será realizado da seguinte forma:
- Entrada: R$ [0,00] na data [00/00/0000].
- Parcelas: [Descrever pagamentos semanais ou quinzenais conforme entrega].

PRAZOS:
Início dos trabalhos: [Data]
Previsão de término: [Data]

OBRIGAÇÕES:
O CONTRATADO deve executar o serviço com qualidade, seguindo normas técnicas, mantendo a limpeza do local e evitando desperdício de materiais.

Data: ____/____/______

_____________________________
Assinatura do Contratante

_____________________________
Assinatura do Contratado`
  },
  {
    id: 'DIARIA',
    title: 'Acordo de Diárias',
    description: 'Para serviços pagos por dia.',
    contentTemplate: `ACORDO DE PRESTAÇÃO DE SERVIÇO POR DIÁRIA

CONTRATANTE: [Seu Nome].
PROFISSIONAL: [Nome do Profissional].

Fica ajustado que o PROFISSIONAL prestará serviços de [Pedreiro/Ajudante/Pintor] na obra localizada em [Endereço].

VALOR DA DIÁRIA:
R$ [Valor] por dia trabalhado (das [07:00] às [17:00]).
Incluso transporte/alimentação: [Sim/Não].

PAGAMENTO:
O pagamento será realizado [Semanalmente/Quinzenalmente], toda [Sexta-feira].

OBSERVAÇÕES:
Faltas não justificadas não serão pagas. O profissional deve zelar pelas ferramentas e materiais.

Data: ____/____/______

_____________________________
Assinatura do Contratante

_____________________________
Assinatura do Profissional`
  },
  {
    id: 'RECIBO_PAGAMENTO',
    title: 'Recibo de Pagamento',
    description: 'Comprovante para controle financeiro.',
    contentTemplate: `RECIBO DE PAGAMENTO

VALOR: R$ [Valor Numérico]

Recebi de [Seu Nome], a importância supramencionada de ([Valor por Extenso]), referente ao pagamento de:
[ ] Diárias (Período: __/__ a __/__)
[ ] Adiantamento de Empreita (Etapa: __________)
[ ] Saldo Final de Serviço
[ ] Material (Reembolso)

Serviço realizado na obra: [Nome/Endereço da Obra].

Para clareza e verdade, firmo o presente recibo dando plena quitação do valor recebido.

[Cidade/UF], [Data].

_____________________________
Assinatura do Recebedor
Nome: [Nome do Profissional]
CPF: [CPF do Profissional]`
  },
  {
    id: 'ENTREGA_OBRA',
    title: 'Termo de Entrega de Serviço',
    description: 'Formaliza que o serviço foi concluído.',
    contentTemplate: `TERMO DE ENTREGA E ACEITE DE SERVIÇO

Eu, [Seu Nome], CONTRATANTE, declaro para os devidos fins que recebi os serviços contratados de [Nome do Profissional/Empresa], referentes à:
- [Descrever o que foi entregue, ex: Pintura completa da sala]

Declaro que os serviços foram inspecionados e estão de acordo com o combinado, não havendo pendências visíveis nesta data.

O pagamento final referente a este serviço foi realizado nesta data, dando-se plena quitação ao contrato.

Local: [Cidade/UF]
Data: ____/____/______

_____________________________
Assinatura do Contratante

_____________________________
Assinatura do Contratado`
  }
];

// --- CHECKLISTS ---
export const STANDARD_CHECKLISTS = [
  {
    category: 'Vistoria de Imóvel Novo',
    items: [
      'Verificar caimento de água em áreas molhadas (banheiro/sacada)',
      'Testar todas as tomadas com um equipamento',
      'Abrir e fechar todas as portas e janelas (verificar trincos)',
      'Verificar se há pisos ocos (bater levemente com cabo de vassoura)',
      'Checar pressão da água nas torneiras e chuveiro',
      'Verificar pintura (manchas, descascados ou falhas)',
      'Conferir rejuntes (falhas ou buracos)',
      'Olhar o quadro de luz (identificação dos disjuntores)'
    ]
  },
  {
    category: 'Início de Obra',
    items: [
      'Água e Luz provisórias ligadas',
      'Tapume ou fechamento da obra instalado',
      'Banheiro para operários funcionando',
      'Local de armazenamento de cimento (seco e alto)',
      'Projetos impressos na obra (Arquitetônico, Hidráulico, Elétrico)',
      'EPIs básicos comprados (Capacete, Luva, Bota)',
      'Placa da obra (se exigido pela prefeitura)',
      'Caçamba ou local de descarte definido'
    ]
  },
  {
    category: 'Antes da Concretagem (Laje)',
    items: [
      'Conferir escoramento (se está firme e alinhado)',
      'Verificar caixinhas de luz (se estão bem presas)',
      'Checar tubulação elétrica (conduítes não amassados)',
      'Verificar espaçadores da ferragem (para não encostar na madeira)',
      'Molhar as formas de madeira antes do concreto',
      'Conferir nível da laje'
    ]
  },
  {
    category: 'Elétrica e Hidráulica',
    items: [
      'Tirar fotos das paredes com tubulação antes de rebocar',
      'Testar vazamento de canos (deixar com água pressurizada)',
      'Conferir altura das tomadas e interruptores',
      'Verificar se há disjuntor exclusivo para chuveiro',
      'Conferir aterramento'
    ]
  }
];
