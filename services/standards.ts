// Standard Libraries for Construction Management

export const ZE_AVATAR = "./ze.png"; // Certifique-se de salvar a imagem na pasta public como ze.png

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

// --- MATERIAL CALCULATORS LOGIC ---

export const CALCULATOR_LOGIC = {
  FLOOR: (area: number) => {
    const margin = 1.10; // 10%
    return {
      tiles: Math.ceil(area * margin),
      mortar: Math.ceil((area * 4) / 20), // ~4kg/m2, sacos de 20kg
      grout: Math.ceil((area * 0.3)), // ~300g/m2 (kg)
    };
  },
  WALL: (width: number, height: number) => {
    const area = width * height;
    // Tijolo 8 furos (9x19x19) ~ 25 por m2 em pé ou deitado varia, usaremos média de 25
    return {
      area: area.toFixed(2),
      bricks: Math.ceil(area * 25),
      cement: Math.ceil(area * 0.15), // Estimativa sacos para assentamento
      sand: Math.ceil(area * 0.02), // m3
    };
  },
  PAINT: (area: number) => {
    // Tinta rende ~10m2 por litro por demão. 2 demãos = 5m2/litro
    const liters = Math.ceil(area / 5);
    const cans18 = Math.floor(liters / 18);
    const remainder = liters % 18;
    const gallons36 = Math.ceil(remainder / 3.6);
    
    return {
      litersTotal: liters,
      cans18,
      gallons36,
      spackle: Math.ceil(area / 12), // Massa corrida latas
      sealer: Math.ceil(area / 40), // Selador latas
    };
  },
  ESTIMATOR: (bathrooms: number, rooms: number) => {
    return {
      toilets: bathrooms,
      sinks: bathrooms + 1, // +1 cozinha
      showers: bathrooms,
      outlets: (rooms * 5) + (bathrooms * 2) + 6, // 5/quarto, 2/banheiro, 6 cozinha/sala
      switches: rooms + bathrooms + 2,
      lightPoints: rooms + bathrooms + 2
    };
  }
};

export interface MaterialCatalog {
  category: string;
  items: {name: string, unit: string}[];
}

// FULL BACKUP CATALOG (Used when Supabase table is not reachable or as fallback)
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
  },
  {
    id: 'RECIBO',
    title: 'Recibo de Pagamento Simples',
    description: 'Para comprovar pagamentos a prestadores.',
    contentTemplate: `RECIBO DE PAGAMENTO

VALOR: R$ [Valor]

Recebi de [Seu Nome], a quantia de R$ [Valor por extenso], referente aos serviços de [Descrever serviço] realizados na obra [Endereço da Obra].

Para clareza e verdade, firmo o presente recibo.

Data: ____/____/______

_________________________
Assinatura do Recebedor
CPF: [CPF do Recebedor]`
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
