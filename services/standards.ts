

// Standard Libraries for Construction Management

// --- AVATAR CONFIG ---
export const ZE_AVATAR = './ze.png';
export const ZE_AVATAR_FALLBACK = 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Construction%20Worker.png';

// --- DICAS DINÂMICAS DO ZÉ ---
export interface ZeTip {
  text: string;
  tag: string;
}

export const ZE_TIPS: ZeTip[] = [
  { tag: 'Financeiro', text: 'Evite adiantamentos integrais de mão de obra. Estabeleça um cronograma físico-financeiro e realize pagamentos mediante medição de serviço executado.' },
  { tag: 'Gestão', text: 'Material faltando para a obra mais que chuva. Verifique o estoque 2 dias antes da próxima etapa começar para não pagar diária de pedreiro parado.' },
  { tag: 'Contrato', text: 'O combinado não sai caro. Sempre faça um contrato escrito descrevendo exatamente o que será feito e o que NÃO está incluso no orçamento.' },
  { tag: 'Economia', text: 'Comprar tudo de uma vez pode parecer bom, mas o cimento empedra e o piso quebra. Compre materiais brutos conforme a demanda da etapa.' },
  { tag: 'Estrutura', text: 'Para garantir a durabilidade, respeite a cura do concreto. Molhe a laje ou pilares por pelo menos 7 dias (cura úmida) para evitar trincas.' },
  { tag: 'Instalações', text: 'Tire fotos das paredes com a tubulação hidráulica e elétrica antes de rebocar. Isso é um mapa do tesouro para evitar furar canos no futuro.' },
  { tag: 'Impermeabilização', text: 'Não economize na impermeabilização dos baldrames e áreas molhadas. Resolver infiltração depois de pronto custa 5x mais caro.' },
  { tag: 'Elétrica', text: 'Nunca use fio mais fino que o especificado para o chuveiro (geralmente 6mm ou 10mm). Fio fino esquenta, gasta mais energia e pode causar incêndio.' },
  { tag: 'Acabamento', text: 'Proteja o piso recém-instalado com papelão ondulado ou gesso. O tráfego de obra arranha porcelanato com muita facilidade.' },
  { tag: 'Pintura', text: 'Tinta boa em parede mal lixada não faz milagre. O segredo da pintura perfeita é 80% preparação (lixa/massa) e 20% tinta.' },
  { tag: 'Caimento', text: 'Antes de pagar o azulejista, jogue um balde de água no banheiro e na sacada. A água tem que correr sozinha para o ralo, sem empoçar.' },
  { tag: 'Entulho', text: 'Mantenha a obra limpa. Entulho acumulado esconde ferramentas, causa acidentes e passa a impressão de desorganização para a equipe.' }
];

export const getRandomZeTip = (): ZeTip => {
  const randomIndex = Math.floor(Math.random() * ZE_TIPS.length);
  return ZE_TIPS[randomIndex];
};

export interface PhaseCategory {
  category: string;
  steps: string[];
}

export const STANDARD_PHASES: PhaseCategory[] = [
  {
    category: 'Preparação',
    steps: ['Limpeza do terreno', 'Preparação de Canteiro', 'Demolição', 'Retirada de entulho']
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
    steps: ['Pisos e Revestimentos', 'Azulejos', 'Marmoraria (Bancadas)', 'Instalação de Louças e Metais', 'Esquadrias (Janelas/Portas)']
  },
  {
    category: 'Pintura e Finalização',
    steps: ['Massa Corrida e Lixamento', 'Pintura Paredes/Tetos', 'Instalação de Luminárias', 'Limpeza Final e Entrega']
  }
];

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
      'Pisos e Revestimentos', 'Gesso / Forro', 'Pintura Paredes/Tetos', 'Instalação de Louças e Metais',
      'Limpeza Final e Entrega'
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
      'Instalação de Louças e Metais', 'Instalação de Luminárias', 'Limpeza Final e Entrega'
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
      'Azulejos', 'Pisos e Revestimentos', 'Gesso / Forro', 'Instalação de Louças e Metais', 'Limpeza Final e Entrega'
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
      'Azulejos', 'Pisos e Revestimentos', 'Marmoraria (Bancadas)', 'Instalação de Louças e Metais', 'Limpeza Final e Entrega'
    ]
  },
  {
    id: 'PINTURA',
    label: 'Só Pintura',
    icon: 'fa-paint-roller',
    description: 'Renovar as paredes e tetos.',
    defaultDurationDays: 10,
    includedSteps: [
      'Proteção do piso', 'Massa Corrida e Lixamento', 'Pintura Paredes/Tetos', 'Limpeza Final e Entrega'
    ]
  }
];

export interface MaterialCatalog {
  category: string;
  items: {name: string, unit: string, multiplier?: number}[];
}

// FULL BACKUP CATALOG COM ESTIMATIVAS INTELIGENTES
export const FULL_MATERIAL_PACKAGES: MaterialCatalog[] = [
  {
    category: 'Limpeza e Preparação',
    items: [
      { name: 'Sacos de Entulho (Ráfia)', unit: 'un', multiplier: 0.5 },
      { name: 'Caçamba de Entulho', unit: 'un', multiplier: 0.05 },
      { name: 'Enxada / Pá', unit: 'un', multiplier: 0.02 },
      { name: 'Carrinho de Mão', unit: 'un', multiplier: 0.01 },
      { name: 'Cimento CP-II (Fundação)', unit: 'sacos', multiplier: 0.3 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.04 },
      { name: 'Brita 1', unit: 'm³', multiplier: 0.04 },
      { name: 'Pedra de Mão (Rachão)', unit: 'm³', multiplier: 0.02 },
      { name: 'Vergalhão 3/8 (10mm)', unit: 'barras', multiplier: 0.5 },
      { name: 'Vergalhão 5/16 (8mm)', unit: 'barras', multiplier: 0.5 },
      { name: 'Tábua de Pinus (Caixaria)', unit: 'dz', multiplier: 0.1 },
      { name: 'Impermeabilizante betuminoso', unit: 'latas', multiplier: 0.05 }
    ]
  },
  {
    category: 'Alvenaria',
    items: [
      { name: 'Tijolo Cerâmico 8 furos', unit: 'milheiro', multiplier: 0.07 },
      { name: 'Bloco de Concreto (Se necessário)', unit: 'un', multiplier: 0.001 }, // Baixo multiplicador para garantir não vir zerado se selecionado
      { name: 'Cimento CP-II', unit: 'sacos', multiplier: 0.2 },
      { name: 'Cal Hidratada (Liga)', unit: 'sacos', multiplier: 0.2 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.05 },
      { name: 'Ferro para Vergas (Cabelo)', unit: 'barras', multiplier: 0.1 },
      { name: 'Aditivo Plastificante', unit: 'litros', multiplier: 0.05 }
    ]
  },
  {
    category: 'Telhado',
    items: [
      { name: 'Telha Cerâmica/Concreto', unit: 'un', multiplier: 16 },
      { name: 'Viga de Madeira (Peroba/Garapeira)', unit: 'm', multiplier: 0.5 },
      { name: 'Caibros', unit: 'm', multiplier: 1.5 },
      { name: 'Ripas', unit: 'm', multiplier: 3.5 },
      { name: 'Prego de Telheiro', unit: 'kg', multiplier: 0.02 },
      { name: 'Manta Térmica', unit: 'rolos', multiplier: 0.02 },
      { name: 'Caixa D\'água 1000L', unit: 'un', multiplier: 0.01 } // Garante 1un
    ]
  },
  {
    category: 'Elétrica',
    items: [
      { name: 'Eletroduto Corrugado (Amarelo)', unit: 'rolos', multiplier: 0.1 },
      { name: 'Caixa de Luz 4x2', unit: 'un', multiplier: 0.4 },
      { name: 'Caixa de Luz 4x4', unit: 'un', multiplier: 0.1 },
      { name: 'Cabo Flexível 2.5mm', unit: 'rolos', multiplier: 0.05 },
      { name: 'Cabo Flexível 1.5mm', unit: 'rolos', multiplier: 0.03 },
      { name: 'Cabo Flexível 6mm', unit: 'm', multiplier: 0.5 },
      { name: 'Disjuntores', unit: 'un', multiplier: 0.15 },
      { name: 'Quadro de Distribuição', unit: 'un', multiplier: 0.01 }, // Garante 1un
      { name: 'Fita Isolante', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Hidráulica',
    items: [
      { name: 'Tubo PVC Soldável 25mm', unit: 'barras', multiplier: 0.2 },
      { name: 'Tubo Esgoto 100mm', unit: 'barras', multiplier: 0.1 },
      { name: 'Tubo Esgoto 40mm', unit: 'barras', multiplier: 0.15 },
      { name: 'Joelho 90 graus 25mm', unit: 'un', multiplier: 0.5 },
      { name: 'Cola para PVC', unit: 'tubo', multiplier: 0.05 },
      { name: 'Registro de Gaveta', unit: 'un', multiplier: 0.02 },
      { name: 'Registro de Pressão', unit: 'un', multiplier: 0.03 },
      { name: 'Caixa Sifonada', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Acabamento',
    items: [
      { name: 'Piso / Porcelanato', unit: 'm²', multiplier: 1.15 },
      { name: 'Argamassa AC-II/AC-III', unit: 'sacos', multiplier: 0.25 },
      { name: 'Rejunte', unit: 'kg', multiplier: 0.3 },
      { name: 'Espaçadores', unit: 'pct', multiplier: 0.05 },
      { name: 'Rodapé', unit: 'm', multiplier: 1.1 }
    ]
  },
  {
    category: 'Louças e Metais',
    items: [
      { name: 'Vaso Sanitário com Caixa Acoplada', unit: 'un', multiplier: 0.02 }, // ~1 a cada 50m2 ou min 1
      { name: 'Cuba / Pia de Banheiro', unit: 'un', multiplier: 0.02 },
      { name: 'Torneira de Banheiro', unit: 'un', multiplier: 0.02 },
      { name: 'Torneira de Cozinha', unit: 'un', multiplier: 0.01 },
      { name: 'Chuveiro / Ducha', unit: 'un', multiplier: 0.02 },
      { name: 'Kit Acessórios (Toalheiro/Papeleira)', unit: 'kit', multiplier: 0.02 },
      { name: 'Sifão Universal', unit: 'un', multiplier: 0.04 },
      { name: 'Engate Flexível', unit: 'un', multiplier: 0.04 },
      { name: 'Válvula de Escoamento (Ralo pia)', unit: 'un', multiplier: 0.04 }
    ]
  },
  {
    category: 'Pintura',
    items: [
      { name: 'Lixa de Parede', unit: 'folhas', multiplier: 0.5 },
      { name: 'Selador Acrílico', unit: 'latas', multiplier: 0.02 },
      { name: 'Massa Corrida', unit: 'latas', multiplier: 0.05 },
      { name: 'Tinta Acrílica', unit: 'latas', multiplier: 0.05 },
      { name: 'Rolo de Lã e Pincel', unit: 'un', multiplier: 0.04 },
      { name: 'Fita Crepe', unit: 'rolos', multiplier: 0.05 },
      { name: 'Lona Plástica', unit: 'm', multiplier: 1 }
    ]
  },
  {
    category: 'Limpeza Final',
    items: [
      { name: 'Ácido para Limpeza de Pedras', unit: 'galão', multiplier: 0.02 },
      { name: 'Detergente Pós-Obra', unit: 'galão', multiplier: 0.02 },
      { name: 'Vassoura Piaçava', unit: 'un', multiplier: 0.02 },
      { name: 'Rodo Grande', unit: 'un', multiplier: 0.01 },
      { name: 'Panos de Chão (Saco Alvejado)', unit: 'un', multiplier: 0.1 },
      { name: 'Espátula de Aço', unit: 'un', multiplier: 0.02 },
      { name: 'Lã de Aço (Bombril)', unit: 'pct', multiplier: 0.05 }
    ]
  }
];

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

export const CONTRACT_TEMPLATES = [
  {
    id: 'EMPREITA',
    title: 'Contrato de Empreitada',
    description: 'Serviços gerais com valor fechado.',
    contentTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS POR EMPREITADA...`
  },
  // ... outros templates
];

export const STANDARD_CHECKLISTS = [
  {
    category: 'Início de Obra',
    items: [
      'Água e Luz ligados no terreno',
      'Barracão e Banheiro para equipe',
      'Projetos impressos e plastificados',
      'Documentação da Prefeitura (Alvará)',
      'EPIs básicos (Capacete, Botas, Luvas)'
    ]
  },
  {
    category: 'Fundação',
    items: [
      'Gabarito conferido e nivelado',
      'Estacas na profundidade correta',
      'Armaduras sem ferrugem e com espaçadores',
      'Concreto vibrado corretamente',
      'Impermeabilização do baldrame feita'
    ]
  },
  {
    category: 'Alvenaria',
    items: [
      'Prumo e Nível conferidos a cada fiada',
      'Vergas e Contravergas nas janelas/portas',
      'Encunhamento (aperto) no topo da parede',
      'Passagem de conduítes antes de rebocar',
      'Chapisco aplicado em tudo'
    ]
  },
  {
    category: 'Acabamento',
    items: [
      'Caimento de água em banheiros/sacadas',
      'Teste de pressão nos canos (antes de fechar)',
      'Proteção de pisos instalados',
      'Recortes de piso escondidos (atrás da porta)',
      'Teste de tomadas e interruptores'
    ]
  }
];

export const LIFETIME_BONUSES = [
  {
    icon: 'fa-user-group',
    title: 'Comunidade VIP no WhatsApp',
    desc: 'Troque experiências com mestres de obra e engenheiros experientes.'
  },
  {
    icon: 'fa-file-contract',
    title: 'Pacote de Contratos Blindados',
    desc: 'Modelos prontos para evitar dores de cabeça com pedreiros e fornecedores.'
  },
  {
    icon: 'fa-calculator',
    title: 'Calculadoras Avançadas',
    desc: 'Ferramentas exclusivas para cálculo de concreto, telhado e elétrica.'
  },
  {
    icon: 'fa-robot',
    title: 'Zé da Obra Ilimitado',
    desc: 'Acesso prioritário e sem limites ao nosso engenheiro virtual via IA.'
  }
];
