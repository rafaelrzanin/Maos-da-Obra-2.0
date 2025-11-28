


// Standard Libraries for Construction Management

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
  defaultDurationDays: number; // Estimated duration
  includedSteps: string[]; // List of step names from STANDARD_PHASES or custom
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

// --- MATERIAL CALCULATORS ---

export const CALCULATORS = {
  PISO: {
    label: 'Pisos e Revestimentos',
    unit: 'm²',
    calculate: (area: number) => Math.ceil(area * 1.10), // +10% loss
    message: (qty: number) => `Você precisará de ${qty}m² (já considerando 10% de perda para recortes).`
  },
  TIJOLO: {
    label: 'Tijolos / Blocos',
    unit: 'unidades',
    calculate: (area: number) => Math.ceil(area * 25), // Avg 25 blocks per m2
    message: (qty: number) => `Estimamos cerca de ${qty} blocos para cobrir essa área de parede.`
  },
  TINTA: {
    label: 'Tinta (Paredes)',
    unit: 'litros',
    calculate: (area: number) => Math.ceil((area * 2) / 10), // 2 coats, ~10m2 per liter
    message: (qty: number) => `Aproximadamente ${qty} litros de tinta para dar 2 demãos.`
  },
  CIMENTO_CONTRAPISO: {
    label: 'Cimento (Contrapiso)',
    unit: 'sacos (50kg)',
    calculate: (area: number) => Math.ceil(area * 0.25), // Rough estimate
    message: (qty: number) => `Cerca de ${qty} sacos de cimento para um contrapiso padrão.`
  }
};

export interface MaterialCatalog {
  [category: string]: {
    [subcategory: string]: string[];
  };
}

export const STANDARD_MATERIAL_CATALOG: MaterialCatalog = {
  'Estrutura': {
    'Concreto': [
      'Cimento CP-II',
      'Areia média',
      'Brita 1',
      'Brita 2',
      'Aditivo plastificante'
    ],
    'Armadura': [
      'Aço CA50 8mm',
      'Aço CA50 10mm',
      'Vergalhão',
      'Arame recozido'
    ]
  },
  'Alvenaria': {
    'Blocos': [
      'Bloco cerâmico',
      'Bloco de concreto',
      'Tijolo maciço'
    ],
    'Argamassa': [
        'Argamassa Assentamento',
        'Cal Hidratada',
        'Areia fina'
    ]
  },
  'Hidráulica': {
    'Água Fria': [
      'Tubo PVC',
      'Joelho 90',
      'Luva',
      'Registro de pressão',
      'Adesivo PVC'
    ]
  },
  'Elétrica': {
    'Fiação': [
      'Cabo 2.5mm',
      'Cabo 4mm',
      'Cabo 6mm',
      'Conduíte flexível'
    ],
    'Acabamento': [
      'Tomada',
      'Interruptor',
      'Disjuntor'
    ]
  },
  'Acabamento': {
      'Geral': ['Porcelanato', 'Rejunte', 'Tinta Acrílica', 'Massa Corrida', 'Lixa']
  }
};

export const STANDARD_EXPENSE_CATALOG: MaterialCatalog = {
  'Mão de Obra': {
    'Profissionais': ['Pedreiro', 'Ajudante', 'Eletricista', 'Encanador', 'Pintor', 'Mestre de Obras']
  },
  'Material': {
    'Básico': ['Cimento', 'Areia', 'Pedra', 'Tijolo', 'Ferro', 'Madeira'],
    'Acabamento': ['Piso', 'Revestimento', 'Argamassa', 'Rejunte', 'Tinta', 'Gesso']
  }
};

// --- LIFETIME BONUSES ---
export const LIFETIME_BONUSES = [
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
    id: 'PEDREIRO',
    title: 'Contrato de Empreitada (Pedreiro)',
    description: 'Para serviços de alvenaria, reboco e pisos.',
    contentTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PEDREIRO

CONTRATANTE: [Seu Nome], portador do CPF [Seu CPF].
CONTRATADO: [Nome do Pedreiro], portador do CPF [CPF dele].

OBJETO:
O CONTRATADO realizará os serviços de [Descrever serviços, ex: levantar parede, rebocar] no endereço [Endereço da Obra].

VALOR E PAGAMENTO:
O valor total será de R$ [Valor Total].
Forma de pagamento: [Ex: 30% na entrada, restante semanalmente conforme avanço].

PRAZO:
Início: [Data Início]
Previsão de término: [Data Término]

OBRIGAÇÕES:
O CONTRATADO deve prezar pela qualidade, limpeza e evitar desperdício de materiais.

Data: ____/____/______

_________________________
Assinatura Contratante

_________________________
Assinatura Contratado`
  },
  {
    id: 'PINTOR',
    title: 'Contrato de Pintura',
    description: 'Para serviços de pintura interna e externa.',
    contentTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PINTURA

CONTRATANTE: [Seu Nome].
CONTRATADO: [Nome do Pintor].

OBJETO:
Pintura de [Descrever áreas: ex: 3 quartos e sala] incluindo lixamento e massa corrida.

VALOR: R$ [Valor] por m² ou empreitada total.

DETALHES:
A tinta será fornecida pelo [CONTRATANTE].
Materiais de uso pessoal (pincéis, rolos) são do [CONTRATADO].

Data: ____/____/______

_________________________
Assinatura Contratante`
  }
];

// --- STANDARD CHECKLISTS ---
export const STANDARD_CHECKLISTS = [
  {
    category: 'Elétrica',
    items: [
      'Definir posição das tomadas 110v e 220v',
      'Comprar quadro de distribuição',
      'Testar disjuntores',
      'Verificar aterramento',
      'Instalar luminárias'
    ]
  },
  {
    category: 'Hidráulica',
    items: [
      'Testar pressão da água',
      'Verificar caimentos de ralos (teste com balde)',
      'Instalar registros de gaveta',
      'Verificar vazamentos em sifões',
      'Limpar caixa d\'água'
    ]
  },
  {
    category: 'Acabamentos',
    items: [
      'Conferir nível do piso',
      'Proteger pisos prontos com papelão',
      'Testar abertura de portas e janelas',
      'Rejuntar todos os revestimentos'
    ]
  }
];
