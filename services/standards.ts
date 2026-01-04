
// Standard Libraries for Construction Management

// --- AVATAR CONFIG ---
export const ZE_AVATAR = './ze.png';
export const ZE_AVATAR_FALLBACK = 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Construction%20Worker.png';

// REMOVED: ZE_TIPS and getRandomZeTip as Zé Assistant card is removed.

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
    defaultDurationDays: 180, // Será ajustado dinamicamente
    // Estas são as etapas BASE que serão combinadas com as etapas dinâmicas por pavimento
    includedSteps: [
      'Limpeza do terreno', 
      'Fundações', 
      'Estrutura (Lajes e Vigas)', // Generalizado para a estrutura
      'Alvenaria (Paredes)', // Generalizado
      'Cobertura e Telhado', // Generalizado
      'Instalações Hidráulicas Gerais', // Generalizado
      'Instalações Elétricas Gerais', // Generalizado
      'Chapisco e Reboco', 
      'Contrapiso',
      'Impermeabilização Geral', 
      'Gesso e Forro', 
      'Pisos e Revestimentos', 
      'Esquadrias (Janelas e Portas)',
      'Bancadas e Marmoraria', 
      'Pintura Interna e Externa', 
      'Instalação de Louças e Metais', 
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
      'Demolição e Retirada de Entulho Geral', // Modificado para ser genérico
      'Instalações Hidráulicas Gerais', 
      'Instalações Elétricas Gerais',
      'Gesso e Forro', 
      'Contrapiso',
      'Impermeabilização Geral',
      'Pisos e Revestimentos', 
      'Esquadrias (Janelas e Portas)',
      'Bancadas e Marmoraria', 
      'Pintura Interna e Externa', 
      'Instalação de Louças e Metais', 
      'Instalação de Luminárias', 
      'Limpeza Final e Entrega'
    ]
  },
  {
    id: 'BANHEIRO',
    label: 'Reforma de Banheiro',
    icon: 'fa-bath',
    description: 'Troca de piso, louças e impermeabilização.',
    defaultDurationDays: 15,
    includedSteps: [
      'Demolição e Retirada de Entulho (Banheiro)', 
      'Hidráulica de Banheiro', 
      'Elétrica de Banheiro', 
      'Impermeabilização de Banheiro', 
      'Contrapiso de Banheiro', 
      'Pisos e Revestimentos de Banheiro', 
      'Gesso e Forro de Banheiro', 
      'Bancada de Banheiro', 
      'Louças e Metais de Banheiro', 
      'Limpeza Final e Entrega (Banheiro)'
    ]
  },
  {
    id: 'COZINHA',
    label: 'Reforma de Cozinha',
    icon: 'fa-kitchen-set',
    description: 'Azulejos, bancadas e instalações.',
    defaultDurationDays: 20,
    includedSteps: [
      'Demolição e Retirada de Entulho (Cozinha)', 
      'Hidráulica de Cozinha', 
      'Elétrica de Cozinha', 
      'Pisos e Revestimentos de Cozinha', 
      'Bancada de Cozinha', 
      'Louças e Metais de Cozinha', 
      'Limpeza Final e Entrega (Cozinha)'
    ]
  },
  {
    id: 'PINTURA',
    label: 'Serviço de Pintura',
    icon: 'fa-paint-roller',
    description: 'Renovar as paredes e tetos.',
    defaultDurationDays: 10,
    includedSteps: [
      'Proteção e Preparação (Pintura)', 
      'Lixamento e Massa (Pintura)', 
      'Pintura Paredes e Tetos', 
      'Limpeza Final e Entrega (Pintura)'
    ]
  }
];

export interface MaterialItem {
  name: string;
  unit: string;
  multiplier: number; // Será interpretado por db.ts como por m² ou por cômodo, dependendo da categoria
  flat_qty?: number; // Quantidade fixa, não dependente de área ou cômodos (ex: caixa d'água)
}

export interface MaterialCatalog {
  category: string;
  items: MaterialItem[];
}

// CRITICAL: The 'category' key here MUST match the step names in WORK_TEMPLATES above.
// Multipliers are now a base, to be further adjusted dynamically by `db.ts` `regenerateMaterials`.
export const FULL_MATERIAL_PACKAGES: MaterialCatalog[] = [
  {
    category: 'Limpeza do terreno',
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 0.8 }, // por m² de área
      { name: 'Caçamba Estacionária', unit: 'un', multiplier: 0.005, flat_qty: 1 }, // Flat 1 para obras maiores, 0.005 * area
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
      { name: 'Pontalete de Eucalipto (3m)', unit: 'un', multiplier: 0.1 }
    ]
  },
  {
    category: 'Estrutura (Lajes e Vigas)', // Generalizado
    items: [
      { name: 'Laje Pré-Fabricada (Lajota)', unit: 'm²', multiplier: 1.05 }, // 5% de perda
      { name: 'Cimento CP-III (Concretagem)', unit: 'sacos', multiplier: 0.3 },
      { name: 'Areia Média (Concreto)', unit: 'm³', multiplier: 0.05 },
      { name: 'Brita 1 (Concreto)', unit: 'm³', multiplier: 0.04 },
      { name: 'Vergalhão 1/2 (12.5mm)', unit: 'barras', multiplier: 0.8 },
      { name: 'Tábua de Pinus (30cm - Caixaria)', unit: 'dz', multiplier: 0.1 }
    ]
  },
  {
    category: 'Alvenaria (Paredes)', // Generalizado
    items: [
      { name: 'Bloco Cerâmico (9x19x19cm)', unit: 'un', multiplier: 30 }, // por m²
      { name: 'Cimento CP-II (Assentamento)', unit: 'sacos', multiplier: 0.2 },
      { name: 'Areia Fina (Assentamento)', unit: 'm³', multiplier: 0.03 },
      { name: 'Cal para Argamassa', unit: 'sacos', multiplier: 0.05 },
      { name: 'Vergalhão 5/16 (8mm - Cintas)', unit: 'barras', multiplier: 0.2 }
    ]
  },
  {
    category: 'Cobertura e Telhado', // Generalizado
    items: [
      { name: 'Telha Cerâmica Romana', unit: 'un', multiplier: 16 }, // por m²
      { name: 'Madeira para Estrutura (Caibro/Ripa)', unit: 'm', multiplier: 2 },
      { name: 'Parafusos para Telhado', unit: 'caixa', multiplier: 0.05 },
      { name: 'Manta Sub-Telha', unit: 'm²', multiplier: 1 }
    ]
  },
  {
    category: 'Instalações Hidráulicas Gerais', // Generalizado
    items: [
      { name: 'Tubos PVC 100mm (Esgoto)', unit: 'barras', multiplier: 0.05 }, // por m²
      { name: 'Tubos PVC 50mm (Esgoto)', unit: 'barras', multiplier: 0.1 },
      { name: 'Tubos PVC 25mm (Água Fria)', unit: 'barras', multiplier: 0.15 },
      { name: 'Conexões PVC (Diversas)', unit: 'un', multiplier: 0.5 },
      { name: 'Caixa D\'água 1000L', unit: 'un', multiplier: 0, flat_qty: 1 }, 
      { name: 'Cola PVC e Lixa', unit: 'kit', multiplier: 0.02 }
    ]
  },
  {
    category: 'Instalações Elétricas Gerais', // Generalizado
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
    category: 'Impermeabilização Geral', 
    items: [
      { name: 'Manta Asfáltica (1m x 10m)', unit: 'rolos', multiplier: 0.1 },
      { name: 'Asfalto para Manta', unit: 'litros', multiplier: 0.5 },
      { name: 'Argamassa Polimérica', unit: 'kg', multiplier: 0.8 }
    ]
  },
  {
    category: 'Gesso e Forro', // Generalizado
    items: [
      { name: 'Placa de Gesso Acartonado (1.20x1.80m)', unit: 'chapa', multiplier: 0.6 },
      { name: 'Perfil Metálico (Montante)', unit: 'barra', multiplier: 2 },
      { name: 'Massa de Gesso (Rejunte)', unit: 'kg', multiplier: 0.5 },
      { name: 'Parafusos para Gesso', unit: 'caixa', multiplier: 0.01 }
    ]
  },
  {
    category: 'Pisos e Revestimentos', // Generalizado
    items: [
      { name: 'Piso Cerâmico/Porcelanato (60x60cm)', unit: 'm²', multiplier: 1.1 },
      { name: 'Argamassa AC-II / AC-III', unit: 'sacos', multiplier: 0.3 },
      { name: 'Rejunte (cor similar ao piso)', unit: 'kg', multiplier: 0.08 }
    ]
  },
  {
    category: 'Esquadrias (Janelas e Portas)', // Generalizado
    items: [
      { name: 'Janela de Alumínio (1.20x1.20m)', unit: 'un', multiplier: 0.02 }, // por m²
      { name: 'Porta de Madeira (80x210cm)', unit: 'un', multiplier: 0.03 }, // por m²
      { name: 'Fechadura e Dobradiças', unit: 'kit', multiplier: 0.05 }, // por m²
      { name: 'Cimento para Fixação', unit: 'sacos', multiplier: 0.01 } // por m²
    ]
  },
  {
    category: 'Bancadas e Marmoraria', // Generalizado
    items: [
      { name: 'Granito/Mármore (Verde Ubatuba/Travertino)', unit: 'm²', multiplier: 0.1 }, // por m²
      { name: 'Cuba de Inox/Louça', unit: 'un', multiplier: 0.01 }, // por m²
      { name: 'Silicones e Colas', unit: 'tubo', multiplier: 0.01 } // por m²
    ]
  },
  {
    category: 'Pintura Interna e Externa', // Generalizado
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
    category: 'Instalação de Louças e Metais', // Generalizado
    items: [
      { name: 'Vaso Sanitário com Caixa Acoplada', unit: 'un', multiplier: 0.02 }, // por m²
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
      { name: 'Luminárias de Teto (Spots/Plafons)', unit: 'un', multiplier: 0.5 }, // por m²
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
    category: 'Demolição e Retirada de Entulho (Banheiro)',
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 5, flat_qty: 5 }, // 5 por banheiro
      { name: 'Marreta/Talhadeira', unit: 'un', multiplier: 0.01, flat_qty: 0.01 },
      { name: 'Caçamba Estacionária Pequena', unit: 'un', multiplier: 0.005, flat_qty: 0.005 }
    ]
  },
  {
    category: 'Hidráulica de Banheiro',
    items: [
      { name: 'Tubos PVC 50mm (Esgoto)', unit: 'barra', multiplier: 0.5, flat_qty: 0.5 },
      { name: 'Tubos PPR/CPVC 25mm (Água)', unit: 'barra', multiplier: 0.5, flat_qty: 0.5 },
      { name: 'Registros (Pressão/Gaveta)', unit: 'un', multiplier: 3, flat_qty: 3 },
      { name: 'Joelhos/Conexões (Diversas)', unit: 'un', multiplier: 8, flat_qty: 8 },
      { name: 'Cola PVC/Termofusão', unit: 'frasco', multiplier: 0.05, flat_qty: 0.05 }
    ]
  },
  {
    category: 'Elétrica de Banheiro',
    items: [
      { name: 'Fio Flexível 2.5mm', unit: 'm', multiplier: 10, flat_qty: 10 },
      { name: 'Fio Flexível 1.5mm', unit: 'm', multiplier: 5, flat_qty: 5 },
      { name: 'Disjuntor DR (Segurança)', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Caixa de Tomada 4x2', unit: 'un', multiplier: 3, flat_qty: 3 },
      { name: 'Tomada com Proteção', unit: 'un', multiplier: 2, flat_qty: 2 },
      { name: 'Interruptor Simples', unit: 'un', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Impermeabilização de Banheiro',
    items: [
      { name: 'Manta Líquida Acrílica', unit: 'litro', multiplier: 2, flat_qty: 2 },
      { name: 'Cimento Elástico (Argamassa Polimérica)', unit: 'kg', multiplier: 5, flat_qty: 5 },
      { name: 'Tela de Poliéster (Reforço)', unit: 'm²', multiplier: 2, flat_qty: 2 }
    ]
  },
  {
    category: 'Contrapiso de Banheiro',
    items: [
      { name: 'Cimento CP-II', unit: 'saco', multiplier: 0.5, flat_qty: 0.5 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.03, flat_qty: 0.03 }
    ]
  },
  {
    category: 'Pisos e Revestimentos de Banheiro',
    items: [
      { name: 'Piso Retificado (60x60cm)', unit: 'm²', multiplier: 1.15, flat_qty: 1.15 * 5 }, // Assumindo ~5m² por banheiro
      { name: 'Revestimento de Parede (30x60cm)', unit: 'm²', multiplier: 1.15, flat_qty: 1.15 * 15 }, // Assumindo ~15m² por banheiro
      { name: 'Argamassa AC-II / AC-III', unit: 'saco', multiplier: 1, flat_qty: 1 },
      { name: 'Rejunte Epóxi (Anti-mofo)', unit: 'kg', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Gesso e Forro de Banheiro', // Generalizado
    items: [
      { name: 'Placa de Gesso Hidrofugado', unit: 'chapa', multiplier: 0.5, flat_qty: 0.5 },
      { name: 'Massa de Gesso', unit: 'kg', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Bancada de Banheiro',
    items: [
      { name: 'Mármore/Granito (Bancada)', unit: 'm', multiplier: 1.2, flat_qty: 1.2 },
      { name: 'Cuba de Sobrepor/Encaixe', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Válvula de Escoamento', unit: 'un', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Louças e Metais de Banheiro',
    items: [
      { name: 'Vaso Sanitário com Caixa Acoplada', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Torneira (Bancada)', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Chuveiro (com ou sem misturador)', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Ducha Higiênica', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Espelho com Armário', unit: 'un', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Demolição e Retirada de Entulho (Cozinha)',
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 8, flat_qty: 8 },
      { name: 'Marreta/Talhadeira', unit: 'un', multiplier: 0.01, flat_qty: 0.01 },
      { name: 'Caçamba Estacionária Pequena', unit: 'un', multiplier: 0.005, flat_qty: 0.005 }
    ]
  },
  {
    category: 'Hidráulica de Cozinha',
    items: [
      { name: 'Tubos PVC 50mm (Esgoto)', unit: 'barra', multiplier: 0.8, flat_qty: 0.8 },
      { name: 'Tubos PPR/CPVC 25mm (Água)', unit: 'barra', multiplier: 0.8, flat_qty: 0.8 },
      { name: 'Registros', unit: 'un', multiplier: 2, flat_qty: 2 },
      { name: 'Joelhos/Conexões (Diversas)', unit: 'un', multiplier: 10, flat_qty: 10 },
      { name: 'Cola PVC/Termofusão', unit: 'frasco', multiplier: 0.05, flat_qty: 0.05 }
    ]
  },
  {
    category: 'Elétrica de Cozinha',
    items: [
      { name: 'Fio Flexível 4.0mm (Eletrodomésticos)', unit: 'm', multiplier: 15, flat_qty: 15 },
      { name: 'Fio Flexível 2.5mm (Tomadas)', unit: 'm', multiplier: 10, flat_qty: 10 },
      { name: 'Disjuntores (Cozinha)', unit: 'un', multiplier: 3, flat_qty: 3 },
      { name: 'Caixa de Tomada 4x2', unit: 'un', multiplier: 6, flat_qty: 6 },
      { name: 'Tomada 20A', unit: 'un', multiplier: 3, flat_qty: 3 },
      { name: 'Tomada 10A', unit: 'un', multiplier: 3, flat_qty: 3 }
    ]
  },
  {
    category: 'Pisos e Revestimentos de Cozinha',
    items: [
      { name: 'Piso Porcelanato (60x60cm)', unit: 'm²', multiplier: 1.15, flat_qty: 1.15 * 10 }, // Assumindo ~10m² por cozinha
      { name: 'Revestimento de Parede (30x60cm)', unit: 'm²', multiplier: 1.15, flat_qty: 1.15 * 20 }, // Assumindo ~20m² por cozinha
      { name: 'Argamassa AC-III', unit: 'saco', multiplier: 1.2, flat_qty: 1.2 },
      { name: 'Rejunte Flexível', unit: 'kg', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Bancada de Cozinha',
    items: [
      { name: 'Granito/Quartzo (Bancada)', unit: 'm', multiplier: 3, flat_qty: 3 },
      { name: 'Cuba de Inox Simples/Dupla', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Válvula de Escoamento', unit: 'un', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Louças e Metais de Cozinha',
    items: [
      { name: 'Torneira Gourmet/Misturador', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Filtro de Água', unit: 'un', multiplier: 1, flat_qty: 1 },
      { name: 'Sifões e Engates Flexíveis', unit: 'un', multiplier: 1, flat_qty: 1 }
    ]
  },
  {
    category: 'Proteção e Preparação (Pintura)', // Generalizado
    items: [
      { name: 'Lona Plástica Grossa', unit: 'm²', multiplier: 1.1 },
      { name: 'Fita Crepe Larga', unit: 'rolo', multiplier: 0.5 },
      { name: 'Papelão Ondulado', unit: 'm²', multiplier: 1.1 }
    ]
  },
  {
    category: 'Lixamento e Massa (Pintura)', // Generalizado
    items: [
      { name: 'Massa Corrida (Interna) / Acrílica (Externa)', unit: 'lata', multiplier: 0.15 },
      { name: 'Lixas (Grana 150/220)', unit: 'folha', multiplier: 5 },
      { name: 'Desempenadeira de Aço', unit: 'un', multiplier: 0.05 } 
    ]
  },
  {
    category: 'Pintura Paredes e Tetos', // Generalizado
    items: [
      { name: 'Tinta Acrílica Premium (Branco/Cor)', unit: 'galão', multiplier: 0.2 },
      { name: 'Rolos e Pincéis', unit: 'kit', multiplier: 0.01 },
      { name: 'Bandeja para Tinta', unit: 'un', multiplier: 0.01 }
    ]
  },
  {
    category: 'Demolição e Retirada de Entulho Geral', // NEW: Genérico
    items: [
      { name: 'Sacos de Ráfia (Entulho)', unit: 'un', multiplier: 1, flat_qty: 20 }, // Baseado em 20 sacos para uma reforma média
      { name: 'Caçamba Estacionária', unit: 'un', multiplier: 0.005, flat_qty: 1 },
      { name: 'Marreta/Talhadeira', unit: 'un', multiplier: 0.01, flat_qty: 0.01 }
    ]
  },
];

export interface LifetimeBonus {
  icon: string;
  title: string;
  desc: string;
}

export const LIFETIME_BONUSES: LifetimeBonus[] = [
  {
    icon: 'fa-user-clock',
    title: 'Acesso Vitalício',
    desc: 'Sem mensalidades! Pague uma única vez e tenha acesso ilimitado para sempre.'
  },
  {
    icon: 'fa-robot',
    title: 'Zé da Obra AI Ilimitado',
    desc: 'Seu engenheiro virtual particular sem restrições. Pergunte o que quiser!'
  },
  {
    icon: 'fa-file-contract',
    title: 'Gerador de Contratos Personalizáveis',
    desc: 'Crie contratos de mão de obra e serviços em segundos, de forma profissional.'
  },
  {
    icon: 'fa-list-check',
    title: 'Checklists Inteligentes',
    desc: 'Listas de verificação para cada etapa da obra, garantindo que nada seja esquecido.'
  },
  {
    icon: 'fa-calculator',
    title: 'Calculadoras Avançadas',
    desc: 'Calcule quantidades de materiais (pisos, tintas, blocos) de forma rápida e precisa.'
  },
  {
    icon: 'fa-users-gear',
    title: 'Gestão Completa de Equipe & Fornecedores',
    desc: 'Cadastre, organize e acompanhe todos os seus contatos e orçamentos.'
  },
  {
    icon: 'fa-cloud-arrow-up',
    title: 'Armazenamento Ilimitado de Arquivos',
    desc: 'Guarde plantas, orçamentos e fotos da obra na nuvem com segurança.'
  },
  {
    icon: 'fa-chart-line',
    title: 'Relatórios Detalhados',
    desc: 'Acompanhe o desempenho financeiro e de cronograma com relatórios completos em PDF e Excel.'
  }
];

// NEW: Standard job roles for workers
export const STANDARD_JOB_ROLES = [
  'Pedreiro',
  'Ajudante',
  'Eletricista',
  'Encanador',
  'Pintor',
  'Gesseiro',
  'Carpinteiro',
  'Azulejista',
  'Mestre de Obras',
  'Servente', // Adicionado para ser mais explícito
  'Outro'
];

// NEW: Standard categories for suppliers
export const STANDARD_SUPPLIER_CATEGORIES = [
  'Material de Construção',
  'Madeireira',
  'Ferragens',
  'Elétrica',
  'Hidráulica',
  'Pisos e Revestimentos',
  'Gesso',
  'Tintas',
  'Marmoraria',
  'Vidraçaria',
  'Locação de Equipamentos',
  'Caminhão de Areia/Brita', // Adicionado
  'Limpeza', // Adicionado
  'Outro'
];

// NEW: Contract Templates
export const CONTRACT_TEMPLATES = [
  {
    id: 'contrato-empreita',
    title: 'Contrato de Empreitada',
    category: 'Mão de Obra',
    contentTemplate: `
      CONTRATO DE EMPREITADA DE MÃO DE OBRA

      Pelo presente instrumento particular de CONTRATO DE EMPREITADA DE MÃO DE OBRA, de um lado, como CONTRATANTE, (Nome do Contratante), brasileiro(a), (estado civil), (profissão), portador(a) do RG nº (número) e CPF nº (número), residente e domiciliado(a) na (endereço completo), e de outro lado, como CONTRATADO(A), (Nome do Contratado), brasileiro(a), (estado civil), (profissão), portador(a) do RG nº (número) e CPF nº (número), residente e domiciliado(a) na (endereço completo), resolvem, por mútuo acordo, ajustar e contratar o serviço de mão de obra de empreitada, mediante as cláusulas e condições seguintes:

      CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO
      O CONTRATADO obriga-se a executar, com sua equipe e sob sua responsabilidade, os serviços de (descrever os serviços a serem executados, por exemplo: construção de um muro, reforma de um banheiro, instalação de piso, etc.), na obra situada à (endereço da obra).

      CLÁUSULA SEGUNDA – DOS PRAZOS
      O prazo para início dos serviços será em (data de início) e o prazo para conclusão será em (data de término), podendo ser prorrogado mediante acordo formal entre as partes em caso de eventos de força maior ou intercorrências não previstas.

      CLÁUSULA TERCEIRA – DO VALOR E FORMA DE PAGAMENTO
      O valor total da presente empreitada é de R$ (valor total por extenso) ((valor total em números)), a ser pago da seguinte forma:
      1. Sinal: R$ (valor do sinal) no ato da assinatura.
      2. Parcelas: (Número) parcelas de R$ (valor da parcela), a serem pagas conforme (cronograma de pagamentos e etapas).

      CLÁUSULA QUARTA – DOS MATERIAIS
      (Especificar se os materiais serão fornecidos pelo contratante ou contratado. Exemplo: Os materiais necessários para a execução dos serviços serão fornecidos integralmente pelo CONTRATANTE, de acordo com a lista de materiais acordada. OU: Os materiais serão de responsabilidade do CONTRATADO e estão inclusos no valor total da empreitada.)

      CLÁUSULA QUINTA – DAS RESPONSABILIDADES DO CONTRATADO
      O CONTRATADO será responsável por:
      a) Fornecer todas as ferramentas e equipamentos necessários para a execução dos serviços.
      b) Contratar e gerenciar sua própria equipe, assumindo todas as obrigações trabalhistas, previdenciárias e fiscais.
      c) Executar os serviços de acordo com as boas práticas da engenharia/construção, normas técnicas vigentes e projeto fornecido.
      d) Manter a obra organizada e limpa, descartando o entulho em local apropriado.
      e) Reparar eventuais vícios ou defeitos que surgirem em decorrência da má execução dos serviços, no prazo de 90 (noventa) dias após a entrega.

      CLÁUSULA SEXTA – DAS RESPONSABILIDADES DO CONTRATANTE
      O CONTRATANTE será responsável por:
      a) Realizar os pagamentos nas datas e valores acordados.
      b) Fornecer acesso à obra e à água/energia elétrica para a execução dos serviços.
      c) Aprovar as etapas concluídas para liberação dos pagamentos subsequentes.

      CLÁUSULA SÉTIMA – DA RESCISÃO
      O presente contrato poderá ser rescindido por justa causa, em caso de descumprimento de qualquer uma das cláusulas por qualquer das partes, mediante notificação escrita com antecedência mínima de (número) dias.

      CLÁUSULA OITAVA – DO FORO
      As partes elegem o foro da Comarca de (Cidade), Estado de (Estado), para dirimir quaisquer dúvidas ou litígios decorrentes do presente contrato.

      E por estarem assim justos e contratados, assinam o presente em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

      (Local), (dia) de (mês) de (ano).

      ______________________________________
      CONTRATANTE

      ______________________________________
      CONTRATADO(A)

      TESTEMUNHAS:
      1. ______________________________________
         Nome: (Nome da Testemunha 1)
         CPF: (CPF da Testemunha 1)

      2. ______________________________________
         Nome: (Nome da Testemunha 2)
         CPF: (CPF da Testemunha 2)
    `,
  },
  {
    id: 'contrato-diaria',
    title: 'Contrato de Diária / Prestação de Serviços',
    category: 'Mão de Obra',
    contentTemplate: `
      CONTRATO DE PRESTAÇÃO DE SERVIÇOS POR DIÁRIA

      Pelo presente instrumento particular de CONTRATO DE PRESTAÇÃO DE SERVIÇOS, de um lado, como CONTRATANTE, (Nome do Contratante), brasileiro(a), (estado civil), (profissão), portador(a) do RG nº (número) e CPF nº (número), residente e domiciliado(a) na (endereço completo), e de outro lado, como PRESTADOR(A) DE SERVIÇOS, (Nome do Prestador), brasileiro(a), (estado civil), (profissão), portador(a) do RG nº (número) e CPF nº (número), residente e domiciliado(a) na (endereço completo), resolvem, por mútuo acordo, ajustar e contratar a prestação de serviços por diária, mediante as cláusulas e condições seguintes:

      CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO
      O PRESTADOR de serviços obriga-se a executar os serviços de (descrever os serviços a serem executados, por exemplo: serviços de pedreiro, eletricista, ajudante, etc.), na obra situada à (endereço da obra).

      CLÁUSULA SEGUNDA – DA DIÁRIA E FORMA DE PAGAMENTO
      O valor da diária de trabalho será de R$ (valor da diária por extenso) ((valor da diária em números)), a ser paga ao final de cada dia de serviço ou semanalmente, conforme acordado entre as partes. O pagamento será realizado mediante (forma de pagamento, ex: dinheiro, Pix).

      CLÁUSULA TERCEIRA – DOS PRAZOS
      A prestação dos serviços terá início em (data de início), sem prazo determinado para término, podendo ser encerrada a qualquer tempo por qualquer das partes, mediante aviso prévio de (número) dias (ou imediato, se acordado).

      CLÁUSULA QUARTA – DOS MATERIAIS E FERRAMENTAS
      Os materiais necessários para a execução dos serviços serão fornecidos integralmente pelo CONTRATANTE. As ferramentas e equipamentos de uso pessoal e segurança (EPIs) serão de responsabilidade do PRESTADOR.

      CLÁUSULA QUINTA – DAS RESPONSABILIDADES DO PRESTADOR
      O PRESTADOR de serviços será responsável por:
      a) Executar os serviços com diligência e de acordo com as orientações do CONTRATANTE.
      b) Utilizar os materiais e equipamentos de forma adequada e segura.
      c) Zelar pela organização e limpeza do local de trabalho.

      CLÁUSULA SEXTA – DAS RESPONSABILIDADES DO CONTRATANTE
      O CONTRATANTE será responsável por:
      a) Efetuar o pagamento da diária nas condições e prazos estabelecidos.
      b) Fornecer os materiais necessários para a execução dos serviços.
      c) Proporcionar condições seguras de trabalho.

      CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO EMPREGATÍCIO
      O presente contrato é de natureza civil, não configurando vínculo empregatício entre as partes, sendo o PRESTADOR de serviços autônomo, sem subordinação ou exclusividade.

      CLÁUSULA OITAVA – DO FORO
      As partes elegem o foro da Comarca de (Cidade), Estado de (Estado), para dirimir quaisquer dúvidas ou litígios decorrentes do presente contrato.

      E por estarem assim justos e contratados, assinam o presente em 2 (duas) vias de igual tenor e forma, na presença das testemunhas abaixo.

      (Local), (dia) de (mês) de (ano).

      ______________________________________
      CONTRATANTE

      ______________________________________
      PRESTADOR(A) DE SERVIÇOS

      TESTEMUNHAS:
      1. ______________________________________
         Nome: (Nome da Testemunha 1)
         CPF: (CPF da Testemunha 1)

      2. ______________________________________
         Nome: (Nome da Testemunha 2)
         CPF: (CPF da Testemunha 2)
    `,
  },
  {
    id: 'recibo-pagamento',
    title: 'Recibo de Pagamento de Mão de Obra',
    category: 'Recibos',
    contentTemplate: `
      RECIBO DE PAGAMENTO

      Eu, (Nome do Recebedor), (nacionalidade), (estado civil), (profissão), portador(a) do RG nº (número) e CPF nº (número), residente e domiciliado(a) na (endereço completo), declaro para os devidos fins que recebi de (Nome do Pagador), portador(a) do CPF nº (número), a importância de R$ (valor por extenso) ((valor em números)), referente ao pagamento de (descrever o serviço ou período, por exemplo: serviços de pedreiro referente à semana de 01/01/2024 a 05/01/2024, ou: parcela da empreitada referente à etapa de fundação), da obra situada à (endereço da obra).

      O presente recibo é emitido para que produza seus devidos e legais efeitos.

      (Local), (dia) de (mês) de (ano).

      ______________________________________
      Assinatura do Recebedor
      Nome: (Nome do Recebedor)
      CPF: (CPF do Recebedor)
    `,
  },
  {
    id: 'recibo-final-obra',
    title: 'Recibo de Entrega e Quitação Final da Obra',
    category: 'Recibos',
    contentTemplate: `
      RECIBO DE ENTREGA E QUITAÇÃO FINAL DA OBRA

      Eu, (Nome do Contratado/Empreiteiro), (nacionalidade), (estado civil), (profissão), portador(a) do RG nº (número) e CPF nº (número), residente e domiciliado(a) na (endereço completo), doravante denominado(a) CONTRATADO(A), declaro para os devidos fins que, em (dia) de (mês) de (ano), recebi de (Nome do Contratante), portador(a) do CPF nº (número), doravante denominado(a) CONTRATANTE, a importância final de R$ (valor por extenso) ((valor em números)), referente à quitação total dos serviços de (descrever o objeto do contrato, por exemplo: construção civil, reforma de imóvel, etc.), na obra situada à (endereço da obra).

      Com o presente recibo, o(a) CONTRATADO(A) dá plena, rasa e geral quitação de todo e qualquer débito referente aos serviços executados na referida obra, nada mais tendo a reclamar do(a) CONTRATANTE a qualquer título, seja de mão de obra, materiais, multas contratuais ou quaisquer outros encargos.

      Declara, ainda, o(a) CONTRATADO(A) ter cumprido integralmente todas as suas obrigações contratuais, bem como todas as responsabilidades trabalhistas, previdenciárias e fiscais de sua equipe, isentando o(a) CONTRATANTE de qualquer ônus ou responsabilidade nesse sentido.

      O presente recibo é emitido em 2 (duas) vias de igual teor e forma, para que produza seus devidos e legais efeitos.

      (Local), (dia) de (mês) de (ano).

      ______________________________________
      Assinatura do CONTRATADO(A)
      Nome: (Nome do Contratado/Empreiteiro)
      CPF: (CPF do Contratado/Empreiteiro)

      ______________________________________
      Assinatura do CONTRATANTE (Ciente)
      Nome: (Nome do Contratante)
      CPF: (CPF do Contratante)
    `,
  },
];

// NEW: Checklist Templates (mock data)
// CRITICAL: The 'category' key here MUST match the step names in WORK_TEMPLATES
// to allow dynamic loading based on the work's steps.
import { Checklist } from '../types.ts'; // Import Checklist type

export const CHECKLIST_TEMPLATES: Checklist[] = [
  {
    id: 'ckl-fundacao-1',
    workId: 'mock-work-id', // Placeholder, will be replaced dynamically
    name: 'Fundações - Pré-Concretagem',
    category: 'Fundações',
    items: [
      { id: 'item1', text: 'Verificar nível e esquadro da escavação', checked: false },
      { id: 'item2', text: 'Conferir alinhamento e prumo das sapatas/brocas', checked: false },
      { id: 'item3', text: 'Posicionamento da ferragem conforme projeto estrutural', checked: false },
      { id: 'item4', text: 'Garantir cobrimento mínimo da ferragem (espaçadores)', checked: false },
      { id: 'item5', text: 'Limpeza e umedecimento do fundo da vala antes da concretagem', checked: false },
      { id: 'item6', text: 'Instalação e prumo dos arranques dos pilares e baldrames', checked: false },
      { id: 'item7', text: 'Presença e conferência do gabarito (linhas e níveis)', checked: false },
      { id: 'item8', text: 'Verificar se as formas estão escoradas e contraventadas', checked: false },
      { id: 'item9', text: 'Preparar pontos de espera para instalações (hidráulica/elétrica)', checked: false },
      { id: 'item10', text: 'Disponibilidade de cimento, areia, brita e água para o traço', checked: false },
      { id: 'item11', text: 'Verificar compactação do solo e presença de umidade', checked: false },
      { id: 'item12', text: 'Conferir impermeabilização do baldrame (se já executada)', checked: false },
      { id: 'item13', text: 'Registro fotográfico da ferragem antes da concretagem', checked: false },
    ],
  },
  {
    id: 'ckl-levantamento-paredes-1',
    workId: 'mock-work-id',
    name: 'Alvenaria - Levantamento de Paredes',
    category: 'Alvenaria (Paredes)',
    items: [
      { id: 'item1', text: 'Conferir primeira fiada com nível e prumo (fundação seca)', checked: false },
      { id: 'item2', text: 'Utilizar gabarito e linhas para alinhamento das fiadas', checked: false },
      { id: 'item3', text: 'Espessura uniforme da argamassa de assentamento', checked: false },
      { id: 'item4', text: 'Amarrar as paredes nas quinas e em encontros com pilares', checked: false },
      { id: 'item5', text: 'Furos para passagem de tubulação elétrica e hidráulica (sem quebrar blocos)', checked: false },
      { id: 'item6', text: 'Verificar prumo e nível a cada 3 fiadas', checked: false },
      { id: 'item7', text: 'Cintas de amarração (vergalhões) nas aberturas e no topo das paredes', checked: false },
      { id: 'item8', text: 'Deixar espera para vergas e contravergas', checked: false },
      { id: 'item9', text: 'Limpeza dos excessos de argamassa', checked: false },
    ],
  },
  {
    id: 'ckl-lajes-vigas-1',
    workId: 'mock-work-id',
    name: 'Estrutura - Concretagem',
    category: 'Estrutura (Lajes e Vigas)',
    items: [
      { id: 'item1', text: 'Conferir escoramento e formas (prumo e nível)', checked: false },
      { id: 'item2', text: 'Verificar ferragem (bitolas, espaçamentos, cobrimento)', checked: false },
      { id: 'item3', text: 'Limpeza da área (remover detritos, umedecer formas)', checked: false },
      { id: 'item4', text: 'Instalações elétricas e hidráulicas embutidas posicionadas', checked: false },
      { id: 'item5', text: 'Aguardar liberação do engenheiro/responsável técnico', checked: false },
      { id: 'item6', text: 'Conferir traço do concreto (se for usinado, verificar nota)', checked: false },
      { id: 'item7', text: 'Adensamento do concreto com vibrador (evitar falhas)', checked: false },
      { id: 'item8', text: 'Cura do concreto (molhar por 7 dias, no mínimo)', checked: false },
      { id: 'item9', text: 'Remoção das escoras e formas no tempo correto', checked: false },
    ],
  },
  {
    id: 'ckl-telhado-1',
    workId: 'mock-work-id',
    name: 'Cobertura e Telhado - Estrutura e Cobertura',
    category: 'Cobertura e Telhado',
    items: [
      { id: 'item1', text: 'Conferir estrutura de madeira (dimensões, fixação, escoramento)', checked: false },
      { id: 'item2', text: 'Tratamento da madeira (cupinicida, impermeabilizante)', checked: false },
      { id: 'item3', text: 'Caimento adequado para escoamento da água', checked: false },
      { id: 'item4', text: 'Instalação da manta sub-telha (se aplicável)', checked: false },
      { id: 'item5', text: 'Fixação das telhas (amarração, parafusos)', checked: false },
      { id: 'item6', text: 'Verificar rufos e calhas (alinhamento, caimento, vedação)', checked: false },
      { id: 'item7', text: 'Cumeeiras e espigões bem vedados', checked: false },
      { id: 'item8', text: 'Proteção contra ventos (teste de estanqueidade)', checked: false },
      { id: 'item9', text: 'Limpeza dos excessos de argamassa', checked: false },
    ],
  },
  {
    id: 'ckl-impermeabilizacao-1',
    workId: 'mock-work-id',
    name: 'Impermeabilização Geral', 
    category: 'Impermeabilização Geral',
    items: [
      { id: 'item10', text: 'Superfície do baldrame limpa, seca e regularizada', checked: false },
      { id: 'item11', text: 'Aplicação de primer ou promotor de aderência (se necessário)', checked: false },
      { id: 'item12', text: 'Primeira demão de impermeabilizante (manta asfáltica ou argamassa polimérica)', checked: false },
      { id: 'item13', text: 'Segunda demão cruzada (após secagem da primeira)', checked: false },
      { id: 'item14', text: 'Teste de estanqueidade (se for área horizontal)', checked: false },
      { id: 'item15', text: 'Execução da proteção mecânica (regularização com argamassa)', checked: false },
      { id: 'item16', text: 'Verificar rodapés e cantos (arredondamento/reforço)', checked: false },
      { id: 'item17', text: 'Conferir sobreposição das mantas (se for o caso)', checked: false },
      { id: 'item18', text: 'Remover bolhas de air na aplicação da manta', checked: false },
    ],
  },
  {
    id: 'ckl-eletrica-geral-1',
    workId: 'mock-work-id',
    name: 'Instalações Elétricas Gerais',
    category: 'Instalações Elétricas Gerais',
    items: [
      { id: 'item20', text: 'Passagem e fixação de todos os conduítes (garantir sem amassados)', checked: false },
      { id: 'item21', text: 'Fixação das caixas 4x2, 4x4 e de teto (alinhamento e prumo)', checked: false },
      { id: 'item22', text: 'Passagem de fios com bitolas corretas (iluminação, tomadas, chuveiro)', checked: false },
      { id: 'item23', text: 'Identificação e etiquetagem dos circuitos (tomadas, iluminação, DRs)', checked: false },
      { id: 'item24', text: 'Conexão provisória para teste de continuidade (segurança)', checked: false },
      { id: 'item25', text: 'Instalação do sistema de aterramento (hastes, malha, caixa de inspeção)', checked: false },
      { id: 'item26', text: 'Verificar passagem para ar condicionado, aquecedores, etc.', checked: false },
      { id: 'item27', text: 'Posicionamento do quadro de distribuição (altura e acesso)', checked: false },
      { id: 'item28', text: 'Tirar fotos da fiação antes do reboco (para futuras manutenções)', checked: false },
      { id: 'item29', text: 'Deixar sobra de fio nas caixas para futuras conexões', checked: false },
    ],
  },
  {
    id: 'ckl-hidraulica-banheiro-1',
    workId: 'mock-work-id',
    name: 'Hidráulica de Banheiro', 
    category: 'Hidráulica de Banheiro',
    items: [
      { id: 'item30', text: 'Verificar caimento adequado do esgoto (ralos, vasos, pias)', checked: false },
      { id: 'item31', text: 'Instalação e alinhamento dos registros (chuveiro, gaveta, pressão)', checked: false },
      { id: 'item32', text: 'Teste de estanqueidade (pressão) da tubulação de água fria/quente', checked: false },
      { id: 'item33', text: 'Eliminar bolsões de ar na tubulação para evitar ruídos e golpes de aríete', checked: false },
      { id: 'item34', text: 'Fixação segura e no nível correto dos pontos de água quente/fria', checked: false },
      { id: 'item35', text: 'Posicionamento e diâmetro correto dos pontos de esgoto', checked: false },
      { id: 'item36', text: 'Proteção das tubulações contra danos durante o reboco', checked: false },
      { id: 'item37', text: 'Isolamento térmico para tubulação de água quente', checked: false },
      { id: 'item38', text: 'Instalação de sifões e flexíveis com vedação adequada', checked: false },
    ],
  },
  {
    id: 'ckl-pintura-1',
    workId: 'mock-work-id',
    name: 'Lixamento e Massa (Pintura)',
    category: 'Lixamento e Massa (Pintura)',
    items: [
      { id: 'item40', text: 'Lixamento completo da parede (lixa fina para acabamento)', checked: false },
      { id: 'item41', text: 'Remoção total do pó e resíduos (pano úmido)', checked: false },
      { id: 'item42', text: 'Aplicação de massa corrida (interna) ou acrílica (externa) para corrigir imperfeições', checked: false },
      { id: 'item43', text: 'Reaplique massa e lixe novamente, se for o caso, até superfície lisa', checked: false },
      { id: 'item44', text: 'Isolamento de rodapés, batentes, janelas, espelhos de tomada com fita crepe', checked: false },
      { id: 'item45', text: 'Aplicação de selador/fundo preparador (principalmente em paredes novas)', checked: false },
      { id: 'item46', text: 'Verificar umidade ou mofo na parede (tratar antes de pintar)', checked: false },
      { id: 'item47', text: 'Proteção de pisos e móveis com lona', checked: false },
      { id: 'item48', text: 'Escolha da tinta (tipo e cor) aprovada pelo cliente', checked: false },
    ],
  },
  {
    id: 'ckl-geral-1',
    workId: 'mock-work-id',
    name: 'Geral - Início da Obra',
    category: 'Geral',
    items: [
      { id: 'item50', text: 'Terreno limpo e demarcado', checked: false },
      { id: 'item51', text: 'Contratos de equipe e fornecedores assinados', checked: false },
      { id: 'item52', text: 'Licenças e alvarás em dia', checked: false },
      { id: 'item53', text: 'Canteiro de obras organizado e seguro', checked: false },
      { id: 'item54', text: 'Pontos de água e luz provisórios instalados', checked: false },
      { id: 'item55', text: 'EPIs disponíveis para todos os trabalhadores', checked: false },
      { id: 'item56', text: 'Placa de obra instalada', checked: false },
      { id: 'item57', text: 'Primeira reunião com a equipe para alinhar o cronograma', checked: false },
      { id: 'item58', text: 'Definição de local para descarte de entulho', checked: false },
      { id: 'item59', text: 'Verificar acesso para entrega de materiais', checked: false },
    ],
  },
  {
    id: 'ckl-seguranca-1',
    workId: 'mock-work-id',
    name: 'Segurança e EPIs',
    category: 'Segurança',
    items: [
      { id: 'item60', text: 'Capacete de segurança em uso', checked: false },
      { id: 'item61', text: 'Luvas de proteção adequadas para a tarefa', checked: false },
      { id: 'item62', text: 'Óculos de segurança ou protetor facial', checked: false },
      { id: 'item63', text: 'Calçados de segurança com biqueira', checked: false },
      { id: 'item64', text: 'Cinto de segurança e linha de vida para trabalhos em altura', checked: false },
      { id: 'item65', text: 'Proteção auricular (abafadores ou plugs)', checked: false },
      { id: 'item66', text: 'Máscaras de proteção respiratória (contra pó ou fumos)', checked: false },
      { id: 'item67', text: 'Extintores de incêndio próximos e desobstruídos', checked: false },
      { id: 'item68', text: 'Isolamento de áreas de risco (valas, quedas)', checked: false },
      { id: 'item69', text: 'Primeiros socorros e kit de emergência acessíveis', checked: false },
      { id: 'item70', text: 'Proteção de máquinas e equipamentos', checked: false },
      { id: 'item71', text: 'Sinalização de segurança na obra', checked: false },
      { id: 'item72', text: 'Treinamento de segurança para novos colaboradores', checked: false },
    ],
  },
  {
    id: 'ckl-entrega-1',
    workId: 'mock-work-id',
    name: 'Limpeza Final e Entrega',
    category: 'Limpeza Final e Entrega',
    items: [
      { id: 'item70', text: 'Limpeza geral pós-obra (vidros, pisos, paredes)', checked: false },
      { id: 'item71', text: 'Teste de todas as tomadas e interruptores', checked: false },
      { id: 'item72', text: 'Teste de todas as torneiras, descargas e ralos (caimento)', checked: false },
      { id: 'item73', text: 'Verificar portas e janelas (funcionamento, vedação, ferragens)', checked: false },
      { id: 'item74', text: 'Retoques de pintura e pequenos acabamentos', checked: false },
      { id: 'item75', text: 'Remoção de todo o entulho e resíduos da obra', checked: false },
      { id: 'item76', text: 'Conferência final com o proprietário (lista de pendências)', checked: false },
      { id: 'item77', text: 'Entrega de chaves e manuais de equipamentos', checked: false },
      { id: 'item78', text: 'Quitação final de todos os pagamentos (contratados e fornecedores)', checked: false },
      { id: 'item79', text: 'Documento de entrega e quitação assinado por ambas as partes', checked: false },
      { id: 'item80', text: 'Registro fotográfico da obra finalizada', checked: false },
      { id: 'item81', text: 'Avaliação da satisfação do cliente', checked: false },
    ],
  },
  {
    id: 'ckl-demolicao-entulho-geral',
    workId: 'mock-work-id',
    name: 'Demolição e Retirada de Entulho Geral', // Modificado
    category: 'Demolição e Retirada de Entulho Geral', // Modificado
    items: [
        { id: 'item1', text: 'Planejar sequência de demolição (evitar desabamentos)', checked: false },
        { id: 'item2', text: 'Desligar e isolar instalações elétricas e hidráulicas', checked: false },
        { id: 'item3', text: 'Proteção de áreas e elementos a serem preservados', checked: false },
        { id: 'item4', text: 'Uso obrigatório de EPIs (capacete, óculos, luvas, máscara, botas)', checked: false },
        { id: 'item5', text: 'Isolamento e sinalização da área de trabalho', checked: false },
        { id: 'item6', text: 'Alugar caçamba estacionária com antecedência', checked: false },
        { id: 'item7', text: 'Remoção constante do entulho para evitar acúmulo e acidentes', checked: false },
        { id: 'item8', text: 'Separar materiais recicláveis (madeira, metal) para descarte adequado', checked: false },
        { id: 'item9', text: 'Verificar estruturas vizinhas após demolição', checked: false },
    ],
  },
];