// Standard Libraries for Construction Management

export const ZE_AVATAR = "./ze.png"; 

export interface PhaseCategory {
  category: string;
  steps: string[];
}

export const STANDARD_PHASES: PhaseCategory[] = [
  { category: 'Preparação', steps: ['Limpeza do terreno', 'Demolição'] },
  { category: 'Estrutura', steps: ['Fundações', 'Paredes', 'Lajes', 'Telhado'] },
  { category: 'Instalações', steps: ['Hidráulica', 'Elétrica', 'Ar Condicionado'] },
  { category: 'Acabamento', steps: ['Reboco', 'Pisos', 'Gesso', 'Pintura', 'Louças e Metais'] }
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
    description: 'Do terreno às chaves.',
    defaultDurationDays: 180,
    includedSteps: [] // Logic handled by generator
  },
  {
    id: 'REFORMA_APTO',
    label: 'Reforma de Apartamento',
    icon: 'fa-building',
    description: 'Piso, pintura, gesso e banheiro.',
    defaultDurationDays: 60,
    includedSteps: ['Demolição', 'Elétrica', 'Hidráulica', 'Pisos', 'Pintura', 'Limpeza']
  },
  {
    id: 'BANHEIRO',
    label: 'Reforma de Banheiro',
    icon: 'fa-bath',
    description: 'Troca de tudo.',
    defaultDurationDays: 15,
    includedSteps: ['Demolição', 'Hidráulica', 'Impermeabilização', 'Revestimento', 'Louças']
  },
  {
    id: 'PINTURA',
    label: 'Pintura Geral',
    icon: 'fa-paint-roller',
    description: 'Renovar paredes.',
    defaultDurationDays: 10,
    includedSteps: ['Lixamento', 'Pintura', 'Limpeza']
  }
];

// --- CALCULATORS ---
export const CALCULATOR_LOGIC = {
  FLOOR: (area: number) => ({
    tiles: Math.ceil(area * 1.10),
    mortar: Math.ceil((area * 4) / 20),
    grout: Math.ceil((area * 0.3)),
  }),
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
    return {
      cans18: Math.floor(liters / 18),
      gallons36: Math.ceil((liters % 18) / 3.6),
      spackle: Math.ceil(area / 12),
      sealer: Math.ceil(area / 40),
    };
  },
  ESTIMATOR: (baths: number, rooms: number) => ({
    toilets: baths,
    sinks: baths + 1,
    showers: baths,
    outlets: (rooms * 5) + (baths * 2) + 6,
    switches: rooms + baths + 2,
    lightPoints: rooms + baths + 2
  })
};

// --- MATERIAL CATALOG ---
export const FULL_MATERIAL_PACKAGES = [
  { category: 'Fundação', items: [{name: 'Cimento', unit: 'sc'}, {name: 'Areia', unit: 'm3'}, {name: 'Brita', unit: 'm3'}, {name: 'Ferro 3/8', unit: 'br'}, {name: 'Ferro 5/16', unit: 'br'}, {name: 'Estribo', unit: 'un'}, {name: 'Tábua', unit: 'dz'}, {name: 'Impermeabilizante', unit: 'lt'}] },
  { category: 'Alvenaria', items: [{name: 'Tijolo', unit: 'mil'}, {name: 'Cimento', unit: 'sc'}, {name: 'Cal', unit: 'sc'}, {name: 'Areia', unit: 'm3'}, {name: 'Ferro Cabelo', unit: 'br'}] },
  { category: 'Elétrica', items: [{name: 'Fio 2.5mm', unit: 'rl'}, {name: 'Fio 1.5mm', unit: 'rl'}, {name: 'Caixinha 4x2', unit: 'un'}, {name: 'Disjuntor', unit: 'un'}, {name: 'Eletroduto', unit: 'rl'}] },
  { category: 'Hidráulica', items: [{name: 'Tubo 25mm', unit: 'br'}, {name: 'Tubo Esgoto 100mm', unit: 'br'}, {name: 'Tubo Esgoto 40mm', unit: 'br'}, {name: 'Conexões', unit: 'un'}, {name: 'Cola', unit: 'tb'}] },
  { category: 'Acabamento', items: [{name: 'Piso', unit: 'm2'}, {name: 'Argamassa', unit: 'sc'}, {name: 'Rejunte', unit: 'kg'}] },
  { category: 'Pintura', items: [{name: 'Tinta', unit: 'lt'}, {name: 'Massa Corrida', unit: 'lt'}, {name: 'Lixa', unit: 'un'}, {name: 'Rolo', unit: 'un'}] }
];

export const STANDARD_JOB_ROLES = ['Pedreiro', 'Ajudante', 'Pintor', 'Eletricista', 'Encanador', 'Mestre de Obras'];
export const STANDARD_SUPPLIER_CATEGORIES = ['Material de Construção', 'Elétrica', 'Hidráulica', 'Tintas', 'Madeireira', 'Vidraçaria'];

// --- CONTRACTS ---
export const CONTRACT_TEMPLATES = [
  {
    id: 'EMPREITA',
    title: 'Contrato de Empreitada',
    description: 'Serviço com valor fechado.',
    contentTemplate: `CONTRATO DE EMPREITADA\n\nContratante: [Nome]\nContratado: [Nome]\n\nObjeto: Realização de [Descrever Serviço] no endereço [Endereço].\n\nValor: R$ [Valor]\nPagamento: [Forma de Pagamento]\n\nData: __/__/____\n\nAssinaturas:`
  },
  {
    id: 'DIARIA',
    title: 'Acordo de Diárias',
    description: 'Pagamento por dia trabalhado.',
    contentTemplate: `ACORDO DE DIÁRIA\n\nProfissional: [Nome]\nValor da Diária: R$ [Valor]\nHorário: 07:00 às 17:00\n\nO pagamento será feito semanalmente.`
  },
  {
    id: 'RECIBO',
    title: 'Recibo Simples',
    description: 'Comprovante de pagamento.',
    contentTemplate: `RECIBO\n\nRecebi de [Nome] a quantia de R$ [Valor] referente a [Serviço].\n\nData: __/__/____\nAssinatura:`
  }
];

// --- CHECKLISTS (ANTI-DOR DE CABEÇA) ---
export const STANDARD_CHECKLISTS = [
  {
    category: 'Evite Poças e Vazamentos',
    items: [
      'Caimento do Piso: Jogue um balde de água no box e na varanda. A água corre sozinha pro ralo? Se parar no meio, NÃO aceite.',
      'Teste de Vazamento: Tampe o ralo do box e deixe com água por 24h. Olhe o teto do vizinho de baixo ou as paredes em volta.',
      'Rodapé do Box: A impermeabilização subiu 30cm na parede? Só no chão não adianta.',
      'Ralos Tapados: Durante a obra, os ralos estão fechados? Cimento no cano é entupimento na certa.'
    ]
  },
  {
    category: 'Elétrica Segura',
    items: [
      '110v ou 220v?: Marque com fita vermelha os fios 220v dentro da caixinha antes de pintar. Evita queimar a TV na mudança.',
      'Fio Terra: Tem o fio verde em todas as tomadas? É a segurança da sua família.',
      'Chuveiro Quente: O fio do chuveiro é grosso (6mm ou 10mm)? Fio fino derrete e gasta mais energia.'
    ]
  },
  {
    category: 'Acabamentos',
    items: [
      'Piso Oco: Bata com o cabo de uma chave em cada piso. Se o som for oco, vai soltar em breve.',
      'Dente no Piso: Passe uma moeda entre dois pisos. Se travar, um está mais alto que o outro.',
      'Porta Fantasma: Abra a porta e solte. Ela fica parada? Se fechar sozinha, está torta.'
    ]
  }
];
