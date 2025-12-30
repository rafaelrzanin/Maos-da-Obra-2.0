

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
  { tag: 'Acabamento', text: 'Tinta boa em parede mal lixada não faz milagre. O segredo da pintura perfeita é 80% preparação (lixa/massa) e 20% tinta.' },
  { tag: 'Pintura', text: 'Tinta boa em parede mal lixada não faz milagre. O segredo da pintura perfeita é 80% preparação (lixa/massa) e 20% tinta.' },
  { tag: 'Caimento', text: 'Antes de pagar o azulejista, jogue um balde de água no banheiro e na sacada. A água tem que correr sozinha para o ralo, sem empoçar.' },
  { tag: 'Entulho', text: 'Mantenha a obra limpa. Entulho acumulado esconde ferramentas, causa acidentes e passa a impressão de desorganização para a equipe.' }
];

export const getRandomZeTip = (): ZeTip => {
  const randomIndex = Math.floor(Math.random() * ZE_TIPS.length);
  return ZE_TIPS[randomIndex];
};

export interface WorkTemplate {
  id: string;
  label: string;
  icon: string;
  description: string;
  defaultDurationDays: number; 
  includedSteps: string[];
}

// NOTE: The steps here must MATCH the category names in FULL_MATERIAL_PACKAGES exactly for linking to work.
export const WORK_TEMPLATES: WorkTemplate[] = [
  {
    id: 'CONSTRUCAO',
    label: 'Casa inteira do zero',
    icon: 'fa-house-chimney',
    description: 'Começar do terreno vazio até a mudança.',
    defaultDurationDays: 180,
    includedSteps: [
      'Limpeza do terreno', 
      'Fundações', 
      'Levantamento de paredes', 
      'Lajes e Vigas', 
      'Telhado',
      // Usar os pacotes genéricos de instalações para construção do zero
      'Tubulação de Água/Esgoto Geral', 
      'Fiação Elétrica Geral', 
      'Chapisco e Reboco', 
      'Contrapiso',
      'Impermeabilização', 
      'Gesso / Forro', 
      'Pisos e Revestimentos', 
      'Esquadrias (Janelas/Portas)',
      'Marmoraria Geral (Bancadas)', // Usar o geral para construção
      'Pintura Paredes/Tetos', 
      'Instalação de Louças e Metais Geral', // Usar o geral para construção
      'Instalação de Luminárias',
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
      'Demolição', 
      'Retirada de entulho', 
      // Para reforma completa, ainda podemos usar os gerais, mas o ideal seria ter um "Reforma Elétrica Geral" etc.
      // Por enquanto, mantenho os nomes das etapas para que busquem materiais genéricos ou mais amplos,
      // e os específicos (Banheiro/Cozinha) terão seus próprios.
      'Tubulação de Água/Esgoto Geral', 
      'Fiação Elétrica Geral',
      'Gesso / Forro', 
      'Pisos e Revestimentos', 
      'Marmoraria Geral (Bancadas)', // Usar o geral para reforma completa
      'Pintura Paredes/Tetos', 
      'Instalação de Louças e Metais Geral', // Usar o geral para reforma completa
      'Instalação de Luminárias', 
      'Limpeza Final e Entrega'
    ]
  },
  {
    id: 'BANHEIRO',
    label: 'Só o Banheiro',
    icon: 'fa-bath',
    description: 'Troca de piso, louças e impermeabilização.',
    defaultDurationDays: 15,
    includedSteps: [
      'Demolição de Banheiro', 
      'Hidráulica de Banheiro', 
      'Elétrica de Banheiro', // Nova etapa específica
      'Impermeabilização de Banheiro', 
      'Contrapiso de Banheiro', 
      'Pisos e Revestimentos de Banheiro', 
      'Gesso / Forro de Banheiro', 
      'Bancada de Banheiro', // Nova etapa específica
      'Louças e Metais de Banheiro', // Nova etapa específica
      'Limpeza Final e Entrega'
    ]
  },
  {
    id: 'COZINHA',
    label: 'Só a Cozinha',
    icon: 'fa-kitchen-set',
    description: 'Azulejos, bancadas e instalações.',
    defaultDurationDays: 20,
    includedSteps: [
      'Demolição de Cozinha', 
      'Hidráulica de Cozinha', 
      'Elétrica de Cozinha', // Nova etapa específica
      'Pisos e Revestimentos de Cozinha', 
      'Bancada de Cozinha', // Nova etapa específica
      'Louças e Metais de Cozinha', // Nova etapa específica
      'Limpeza Final e Entrega'
    ]
  },
  {
    id: 'PINTURA',
    label: 'Só Pintura',
    icon: 'fa-paint-roller',
    description: 'Renovar as paredes e tetos.',
    defaultDurationDays: 10,
    includedSteps: [
      'Proteção do Piso para Pintura', // Etapa específica de preparação para pintura
      'Preparação de Superfície (Lixar/Massa)', // Nova etapa específica
      'Pintura Paredes/Tetos', 
      'Limpeza Final e Entrega'
    ]
  }
];

export interface MaterialCatalog {
  category: string;
  items: {name: string, unit: string, multiplier?: number}[];
}

// CRITICAL: The 'category' key here MUST match the step names in WORK_TEMPLATES above.
export const FULL_MATERIAL_PACKAGES: MaterialCatalog[] = [
  {
    category: 'Limpeza do terreno',
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 0.8 },
      { name: 'Caçamba Estacionária', unit: 'un', multiplier: 0.05 },
      { name: 'Tapume (Madeirite)', unit: 'chapa', multiplier: 0.05 },
      { name: 'Sarrafo de Madeira (2.5m)', unit: 'dz', multiplier: 0.02 },
      { name: 'Prego 17x21 (Cabeça dupla)', unit: 'kg', multiplier: 0.01 },
      { name: 'Lona Preta (Proteção)', unit: 'm', multiplier: 0.2 },
      { name: 'EPIs (Luvas/Óculos/Capacete)', unit: 'kit', multiplier: 0.02 }
    ]
  },
  {
    category: 'Fundações',
    items: [
      { name: 'Cimento CP-II (Estrutural)', unit: 'sacos', multiplier: 0.4 },
      { name: 'Areia Média (Lavada)', unit: 'm³', multiplier: 0.06 },
      { name: 'Brita 1', unit: 'm³', multiplier: 0.05 },
      { name: 'Pedra de Mão (Rachão)', unit: 'm³', multiplier: 0.02 },
      { name: 'Vergalhão 3/8 (10mm)', unit: 'barras', multiplier: 0.6 },
      { name: 'Vergalhão 5/16 (8mm)', unit: 'barras', multiplier: 0.4 },
      { name: 'Vergalhão 4.2mm (Estribo)', unit: 'barras', multiplier: 0.8 },
      { name: 'Arame Recozido', unit: 'kg', multiplier: 0.02 },
      { name: 'Tábua de Pinus (30cm - Caixaria)', unit: 'dz', multiplier: 0.15 },
      // Fix: Add missing 'unit' property
      { name: 'Pontalete de Eucalipto (3m)', unit: 'un', multiplier: 0.1 }
    ]
  },
  {
    category: 'Levantamento de paredes',
    items: [
      { name: 'Bloco Cerâmico (9x19x19cm)', unit: 'un', multiplier: 30 },
      { name: 'Cimento CP-II (Assentamento)', unit: 'sacos', multiplier: 0.2 },
      { name: 'Areia Fina (Assentamento)', unit: 'm³', multiplier: 0.03 },
      { name: 'Cal para Argamassa', unit: 'sacos', multiplier: 0.05 },
      { name: 'Vergalhão 5/16 (8mm - Cintas)', unit: 'barras', multiplier: 0.2 }
    ]
  },
  {
    category: 'Lajes e Vigas',
    items: [
      { name: 'Laje Pré-Fabricada (Lajota)', unit: 'm²', multiplier: 1 },
      { name: 'Cimento CP-III (Concretagem)', unit: 'sacos', multiplier: 0.3 },
      { name: 'Areia Média (Concreto)', unit: 'm³', multiplier: 0.05 },
      { name: 'Brita 1 (Concreto)', unit: 'm³', multiplier: 0.04 },
      { name: 'Vergalhão 1/2 (12.5mm)', unit: 'barras', multiplier: 0.8 },
      { name: 'Tábua de Pinus (30cm - Caixaria)', unit: 'dz', multiplier: 0.1 }
    ]
  },
  {
    category: 'Telhado',
    items: [
      { name: 'Telha Cerâmica Romana', unit: 'un', multiplier: 16 },
      { name: 'Madeira para Estrutura (Peroba)', unit: 'm', multiplier: 2 },
      { name: 'Parafusos para Telhado', unit: 'caixa', multiplier: 0.05 },
      { name: 'Manta Sub-Telha', unit: 'm²', multiplier: 1 }
    ]
  },
  {
    category: 'Tubulação de Água/Esgoto Geral',
    items: [
      { name: 'Tubos PVC 100mm (Esgoto)', unit: 'barras', multiplier: 0.1 },
      { name: 'Tubos PVC 50mm (Esgoto)', unit: 'barras', multiplier: 0.15 },
      { name: 'Tubos PVC 25mm (Água Fria)', unit: 'barras', multiplier: 0.2 },
      { name: 'Conexões PVC (Diversas)', unit: 'un', multiplier: 0.5 },
      { name: 'Caixa D\'água 1000L', unit: 'un', multiplier: 0.001 },
      { name: 'Cola PVC e Lixa', unit: 'kit', multiplier: 0.02 }
    ]
  },
  {
    category: 'Fiação Elétrica Geral',
    items: [
      { name: 'Fio Flexível 2.5mm (Tomadas)', unit: 'm', multiplier: 10 },
      { name: 'Fio Flexível 1.5mm (Iluminação)', unit: 'm', multiplier: 8 },
      { name: 'Disjuntores (Diversos)', unit: 'un', multiplier: 0.2 },
      { name: 'Conduítes Flexíveis 3/4', unit: 'm', multiplier: 5 },
      { name: 'Caixas de Passagem 4x2', unit: 'un', multiplier: 0.8 },
      { name: 'Tomadas e Interruptores', unit: 'un', multiplier: 1 }
    ]
  },
  {
    category: 'Chapisco e Reboco',
    items: [
      { name: 'Cimento CP-II', unit: 'sacos', multiplier: 0.3 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.05 },
      { name: 'Cal Hidratada', unit: 'sacos', multiplier: 0.08 }
    ]
  },
  {
    category: 'Contrapiso',
    items: [
      { name: 'Cimento CP-II', unit: 'sacos', multiplier: 0.2 },
      { name: 'Areia Grossa', unit: 'm³', multiplier: 0.07 },
      { name: 'Brita Zero', unit: 'm³', multiplier: 0.03 }
    ]
  },
  {
    category: 'Impermeabilização',
    items: [
      { name: 'Manta Asfáltica (1m x 10m)', unit: 'rolos', multiplier: 0.1 },
      { name: 'Asfalto para Manta', unit: 'litros', multiplier: 0.5 },
      { name: 'Argamassa Polimérica', unit: 'kg', multiplier: 0.8 }
    ]
  },
  {
    category: 'Gesso / Forro',
    items: [
      { name: 'Placa de Gesso Acartonado (1.20x1.80m)', unit: 'chapa', multiplier: 0.6 },
      { name: 'Perfil Metálico (Montante)', unit: 'barra', multiplier: 2 },
      { name: 'Massa de Gesso (Rejunte)', unit: 'kg', multiplier: 0.5 },
      { name: 'Parafusos para Gesso', unit: 'caixa', multiplier: 0.01 }
    ]
  },
  {
    category: 'Pisos e Revestimentos',
    items: [
      { name: 'Piso Cerâmico/Porcelanato (60x60cm)', unit: 'm²', multiplier: 1.1 },
      { name: 'Argamassa AC-II / AC-III', unit: 'sacos', multiplier: 0.3 },
      { name: 'Rejunte (cor similar ao piso)', unit: 'kg', multiplier: 0.08 }
    ]
  },
  {
    category: 'Esquadrias (Janelas/Portas)',
    items: [
      { name: 'Janela de Alumínio (1.20x1.20m)', unit: 'un', multiplier: 0.05 },
      { name: 'Porta de Madeira (80x210cm)', unit: 'un', multiplier: 0.05 },
      { name: 'Fechadura e Dobradiças', unit: 'kit', multiplier: 0.05 },
      { name: 'Cimento para Fixação', unit: 'sacos', multiplier: 0.01 }
    ]
  },
  {
    category: 'Marmoraria Geral (Bancadas)',
    items: [
      { name: 'Granito/Mármore (Verde Ubatuba/Travertino)', unit: 'm²', multiplier: 0.1 },
      { name: 'Cuba de Inox/Louça', unit: 'un', multiplier: 0.01 },
      { name: 'Silicones e Colas', unit: 'tubo', multiplier: 0.01 }
    ]
  },
  {
    category: 'Pintura Paredes/Tetos',
    items: [
      { name: 'Tinta Acrílica Premium (Branco/Cor)', unit: 'galão', multiplier: 0.2 },
      { name: 'Massa Corrida/Acrílica', unit: 'lata', multiplier: 0.1 },
      { name: 'Lixas para Parede (diversas granas)', unit: 'folhas', multiplier: 0.2 },
      { name: 'Rolos e Pincéis', unit: 'kit', multiplier: 0.01 },
      { name: 'Fita Crepe', unit: 'rolos', multiplier: 0.05 },
      { name: 'Lona Plástica para Proteção', unit: 'm', multiplier: 0.1 }
    ]
  },
  {
    category: 'Instalação de Louças e Metais Geral',
    items: [
      { name: 'Vaso Sanitário com Caixa Acoplada', unit: 'un', multiplier: 0.02 },
      { name: 'Pia/Lavatório com Coluna', unit: 'un', multiplier: 0.02 },
      { name: 'Torneiras (Bancada/Parede)', unit: 'un', multiplier: 0.03 },
      { name: 'Chuveiro Elétrico/a Gás', unit: 'un', multiplier: 0.01 },
      { name: 'Assento Sanitário', unit: 'un', multiplier: 0.02 },
      { name: 'Sifões e Engates Flexíveis', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Instalação de Luminárias',
    items: [
      { name: 'Luminárias de Teto (Spots/Plafons)', unit: 'un', multiplier: 0.5 },
      { name: 'Lâmpadas LED (Quente/Fria)', unit: 'un', multiplier: 1 },
      { name: 'Fio Flexível 1.5mm', unit: 'm', multiplier: 1 }
    ]
  },
  {
    category: 'Limpeza Final e Entrega',
    items: [
      { name: 'Sacos de Lixo Reforçados', unit: 'rolos', multiplier: 0.1 },
      { name: 'Produtos de Limpeza (Desinfetante/Detergente)', unit: 'litros', multiplier: 0.05 },
      { name: 'Panos e Rodos', unit: 'un', multiplier: 0.01 }
    ]
  },
  // --- ITENS ESPECÍFICOS PARA REFORMA DE BANHEIRO ---
  {
    category: 'Demolição de Banheiro',
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 5 },
      { name: 'Marreta/Talhadeira', unit: 'un', multiplier: 0.01 },
      { name: 'Caçamba Estacionária Pequena', unit: 'un', multiplier: 0.005 }
    ]
  },
  {
    category: 'Hidráulica de Banheiro',
    items: [
      { name: 'Tubos PVC 50mm (Esgoto)', unit: 'barra', multiplier: 0.5 },
      { name: 'Tubos PPR/CPVC 25mm (Água)', unit: 'barra', multiplier: 0.5 },
      { name: 'Registros (Pressão/Gaveta)', unit: 'un', multiplier: 3 },
      { name: 'Joelhos/Conexões (Diversas)', unit: 'un', multiplier: 8 },
      { name: 'Cola PVC/Termofusão', unit: 'frasco', multiplier: 0.05 }
    ]
  },
  {
    category: 'Elétrica de Banheiro',
    items: [
      { name: 'Fio Flexível 2.5mm', unit: 'm', multiplier: 10 },
      { name: 'Fio Flexível 1.5mm', unit: 'm', multiplier: 5 },
      { name: 'Disjuntor DR (Segurança)', unit: 'un', multiplier: 1 },
      { name: 'Caixa de Tomada 4x2', unit: 'un', multiplier: 3 },
      { name: 'Tomada com Proteção', unit: 'un', multiplier: 2 },
      { name: 'Interruptor Simples', unit: 'un', multiplier: 1 }
    ]
  },
  {
    category: 'Impermeabilização de Banheiro',
    items: [
      { name: 'Manta Líquida Acrílica', unit: 'litro', multiplier: 2 },
      { name: 'Cimento Elástico (Argamassa Polimérica)', unit: 'kg', multiplier: 5 },
      { name: 'Tela de Poliéster (Reforço)', unit: 'm²', multiplier: 2 }
    ]
  },
  {
    category: 'Contrapiso de Banheiro',
    items: [
      { name: 'Cimento CP-II', unit: 'saco', multiplier: 0.5 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.03 }
    ]
  },
  {
    category: 'Pisos e Revestimentos de Banheiro',
    items: [
      { name: 'Piso Retificado (60x60cm)', unit: 'm²', multiplier: 1.15 },
      { name: 'Revestimento de Parede (30x60cm)', unit: 'm²', multiplier: 1.15 },
      { name: 'Argamassa AC-II / AC-III', unit: 'saco', multiplier: 1 },
      { name: 'Rejunte Epóxi (Anti-mofo)', unit: 'kg', multiplier: 1 }
    ]
  },
  {
    category: 'Gesso / Forro de Banheiro',
    items: [
      { name: 'Placa de Gesso Hidrofugado', unit: 'chapa', multiplier: 0.5 },
      { name: 'Massa de Gesso', unit: 'kg', multiplier: 1 }
    ]
  },
  {
    category: 'Bancada de Banheiro',
    items: [
      { name: 'Mármore/Granito (Bancada)', unit: 'm', multiplier: 1.2 },
      { name: 'Cuba de Sobrepor/Encaixe', unit: 'un', multiplier: 1 },
      { name: 'Válvula de Escoamento', unit: 'un', multiplier: 1 }
    ]
  },
  {
    category: 'Louças e Metais de Banheiro',
    items: [
      { name: 'Vaso Sanitário com Caixa Acoplada', unit: 'un', multiplier: 1 },
      { name: 'Torneira (Bancada)', unit: 'un', multiplier: 1 },
      { name: 'Chuveiro (com ou sem misturador)', unit: 'un', multiplier: 1 },
      { name: 'Ducha Higiênica', unit: 'un', multiplier: 1 },
      { name: 'Espelho com Armário', unit: 'un', multiplier: 1 }
    ]
  },
  // --- ITENS ESPECÍFICOS PARA REFORMA DE COZINHA ---
  {
    category: 'Demolição de Cozinha',
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 8 },
      { name: 'Marreta/Talhadeira', unit: 'un', multiplier: 0.01 },
      { name: 'Caçamba Estacionária Pequena', unit: 'un', multiplier: 0.005 }
    ]
  },
  {
    category: 'Hidráulica de Cozinha',
    items: [
      { name: 'Tubos PVC 50mm (Esgoto)', unit: 'barra', multiplier: 0.8 },
      { name: 'Tubos PPR/CPVC 25mm (Água)', unit: 'barra', multiplier: 0.8 },
      { name: 'Registros', unit: 'un', multiplier: 2 },
      { name: 'Joelhos/Conexões (Diversas)', unit: 'un', multiplier: 10 },
      { name: 'Cola PVC/Termofusão', unit: 'frasco', multiplier: 0.05 }
    ]
  },
  {
    category: 'Elétrica de Cozinha',
    items: [
      { name: 'Fio Flexível 4.0mm (Eletrodomésticos)', unit: 'm', multiplier: 15 },
      { name: 'Fio Flexível 2.5mm (Tomadas)', unit: 'm', multiplier: 10 },
      { name: 'Disjuntores (Cozinha)', unit: 'un', multiplier: 3 },
      { name: 'Caixa de Tomada 4x2', unit: 'un', multiplier: 6 },
      { name: 'Tomada 20A', unit: 'un', multiplier: 3 },
      { name: 'Tomada 10A', unit: 'un', multiplier: 3 }
    ]
  },
  {
    category: 'Pisos e Revestimentos de Cozinha',
    items: [
      { name: 'Piso Porcelanato (60x60cm)', unit: 'm²', multiplier: 1.15 },
      { name: 'Revestimento de Parede (30x60cm)', unit: 'm²', multiplier: 1.15 },
      { name: 'Argamassa AC-III', unit: 'saco', multiplier: 1.2 },
      { name: 'Rejunte Flexível', unit: 'kg', multiplier: 1 }
    ]
  },
  {
    category: 'Bancada de Cozinha',
    items: [
      { name: 'Granito/Quartzo (Bancada)', unit: 'm', multiplier: 3 },
      { name: 'Cuba de Inox Simples/Dupla', unit: 'un', multiplier: 1 },
      { name: 'Válvula de Escoamento', unit: 'un', multiplier: 1 }
    ]
  },
  {
    category: 'Louças e Metais de Cozinha',
    items: [
      { name: 'Torneira Gourmet/Misturador', unit: 'un', multiplier: 1 },
      { name: 'Filtro de Água', unit: 'un', multiplier: 1 },
      { name: 'Sifões e Engates Flexíveis', unit: 'un', multiplier: 1 }
    ]
  },
  // --- ITENS ESPECÍFICOS PARA PINTURA ---
  {
    category: 'Proteção do Piso para Pintura',
    items: [
      { name: 'Lona Plástica Grossa', unit: 'm²', multiplier: 1.1 },
      { name: 'Fita Crepe Larga', unit: 'rolo', multiplier: 0.5 },
      { name: 'Papelão Ondulado', unit: 'm²', multiplier: 1.1 }
    ]
  },
  {
    category: 'Preparação de Superfície (Lixar/Massa)',
    items: [
      { name: 'Massa Corrida (Interna) / Acrílica (Externa)', unit: 'lata', multiplier: 0.15 },
      { name: 'Lixas (Grana 150/220)', unit: 'folha', multiplier: 5 },
      { name: 'Desempenadeira de Aço', unit: 'un', multiplier: 0.01 },
      { name: 'Espátulas', unit: 'un', multiplier: 0.01 }
    ]
  }
];

// NEW: Job Roles for Workers (Equipe)
export const STANDARD_JOB_ROLES = [
  "Pedreiro",
  "Eletricista",
  "Encanador",
  "Pintor",
  "Carpinteiro",
  "Gesseiro",
  "Ajudante",
  "Arquiteto(a)",
  "Engenheiro(a)",
  "Mestre de Obras",
  "Outros"
];

// NEW: Categories for Suppliers
export const STANDARD_SUPPLIER_CATEGORIES = [
  "Material de Construção Geral",
  "Material Elétrico",
  "Material Hidráulico",
  "Tintas e Acessórios",
  "Madeira",
  "Ferramentas",
  "Gesso e Drywall",
  "Vidraçaria",
  "Marmoraria",
  "Aluguel de Equipamentos",
  "Caçambas (Remoção de Entulho)",
  "Outros Serviços"
];

// NEW: Standard Checklists (example, could be loaded from DB)
export const STANDARD_CHECKLISTS = [
  {
    id: 'FUNDACAO',
    category: 'Fundações',
    items: [
      { id: 'item1', text: 'Conferir alinhamento e nível do baldrame', checked: false },
      { id: 'item2', text: 'Verificar espaçamento e amarração das ferragens', checked: false },
      { id: 'item3', text: 'Confirmar cura do concreto (7 dias molhando)', checked: false },
    ],
  },
  {
    id: 'HIDRAULICA_BRUTA',
    category: 'Hidráulica Bruta',
    items: [
      { id: 'item1', text: 'Testar vazamentos antes de fechar paredes', checked: false },
      { id: 'item2', text: 'Registrar fotos da tubulação exposta', checked: false },
      { id: 'item3', text: 'Verificar caimento do esgoto', checked: false },
    ],
  },
];

// NEW: Contract Templates (example, could be loaded from DB)
export const CONTRACT_TEMPLATES = [
  {
    id: 'SIMPLES_PEDREIRO',
    title: 'Contrato de Pedreiro (Serviço Pontual)',
    description: 'Modelo simples para pequenos serviços de alvenaria.',
    contentTemplate: `
      CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PEDREIRO

      CONTRATANTE: {{clientName}}, CPF: {{clientCpf}}, residente em {{clientAddress}}.
      CONTRATADO: {{workerName}}, CPF: {{workerCpf}}, residente em {{workerAddress}}.

      OBJETO: O CONTRATADO prestará serviços de pedreiro na obra localizada em {{workAddress}}, conforme as seguintes especificações:
      - {{serviceDescription}}

      PRAZO: Início em {{startDate}} e término em {{endDate}}.
      VALOR: R$ {{contractValue}}, a ser pago da seguinte forma: {{paymentTerms}}.

      Fica eleito o foro da comarca de {{city}} para dirimir quaisquer dúvidas.

      {{city}}, {{date}}.

      _________________________             _________________________
      CONTRATANTE                               CONTRATADO
    `,
  },
  {
    id: 'REFORMA_GERAL',
    title: 'Contrato de Reforma Geral (Empreitada)',
    description: 'Contrato abrangente para reformas completas com múltiplas etapas.',
    contentTemplate: `
      CONTRATO DE EMPREITADA PARA REFORMA DE IMÓVEL

      CONTRATANTE: {{clientName}}, CPF: {{clientCpf}}, residente em {{clientAddress}}.
      CONTRATADO: {{companyName}}, CNPJ: {{companyCnpj}}, sede em {{companyAddress}}.

      OBJETO: Reforma geral do imóvel localizado em {{workAddress}}, incluindo as seguintes etapas:
      1. Demolições e Retirada de Entulho
      2. Instalações Hidráulicas e Elétricas
      3. Alvenaria e Gesso
      4. Pisos e Revestimentos
      5. Pintura
      6. Instalação de Esquadrias e Acabamentos
      Detalhes adicionais em anexo (Memorial Descritivo).

      PRAZO: Início em {{startDate}} e término em {{endDate}}, sujeito a alterações por motivos de força maior ou aditivos.
      VALOR TOTAL: R$ {{contractValue}}, conforme orçamento detalhado nº {{budgetNumber}}.
      PAGAMENTO: Será efetuado em {{installments}} parcelas, mediante medição do avanço físico da obra.

      GARANTIA: O CONTRATADO oferece garantia de {{guaranteeMonths}} meses sobre os serviços executados.

      Fica eleito o foro da comarca de {{city}} para dirimir quaisquer dúvidas.

      {{city}}, {{date}}.

      _________________________             _________________________
      CONTRATANTE                               CONTRATADO
    `,
  },
];

// NEW: Lifetime Bonuses
export const LIFETIME_BONUSES = [
  {
    icon: 'fa-infinity',
    title: 'Acesso Vitalício',
    desc: 'Pague uma vez e use para sempre, sem mensalidades ou taxas ocultas.',
  },
  {
    icon: 'fa-robot',
    title: 'IA Zé da Obra Ilimitada',
    desc: 'Seu assistente virtual com inteligência artificial para tirar dúvidas, calcular materiais e dar dicas, sem limites de uso.',
  },
  {
    icon: 'fa-file-contract',
    title: 'Gerador de Contratos Personalizáveis',
    desc: 'Crie contratos profissionais com pedreiros, empreiteiros e fornecedores em minutos, garantindo segurança jurídica.',
  },
  {
    icon: 'fa-clipboard-check',
    title: 'Checklists Inteligentes',
    desc: 'Tenha acesso a checklists pré-prontos para cada etapa da obra, garantindo que nada seja esquecido.',
  },
  {
    icon: 'fa-chart-line',
    title: 'Relatórios Avançados',
    desc: 'Relatórios detalhados de custos, progresso e materiais em PDF e Excel para uma gestão impecável.',
  },
  {
    icon: 'fa-users-gear',
    title: 'Gestão de Equipe e Fornecedores',
    desc: 'Cadastre e gerencie todos os seus profissionais e fornecedores em um só lugar, otimizando a comunicação.',
  },
];
