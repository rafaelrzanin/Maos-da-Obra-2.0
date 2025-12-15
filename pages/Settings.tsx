
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
      'Tubulação de Água/Esgoto', 
      'Fiação Elétrica', 
      'Chapisco e Reboco', 
      'Contrapiso',
      'Impermeabilização', 
      'Gesso / Forro', 
      'Pisos e Revestimentos', 
      'Esquadrias (Janelas/Portas)',
      'Marmoraria (Bancadas)', 
      'Pintura Paredes/Tetos', 
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
      'Demolição', 
      'Retirada de entulho', 
      'Tubulação de Água/Esgoto', 
      'Fiação Elétrica',
      'Gesso / Forro', 
      'Pisos e Revestimentos', 
      'Marmoraria (Bancadas)',
      'Pintura Paredes/Tetos', 
      'Instalação de Louças e Metais', 
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
      'Demolição', 
      'Tubulação de Água/Esgoto', 
      'Impermeabilização', 
      'Contrapiso', 
      'Pisos e Revestimentos', 
      'Gesso / Forro', 
      'Marmoraria (Bancadas)',
      'Instalação de Louças e Metais', 
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
      'Demolição', 
      'Tubulação de Água/Esgoto', 
      'Fiação Elétrica',
      'Pisos e Revestimentos', 
      'Marmoraria (Bancadas)', 
      'Instalação de Louças e Metais', 
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
      'Proteção do piso', 
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
      { name: 'Pontalete de Eucalipto', unit: 'dz', multiplier: 0.05 }
    ]
  },
  {
    category: 'Levantamento de paredes',
    items: [
      { name: 'Tijolo Cerâmico 8 furos', unit: 'milheiro', multiplier: 0.085 },
      { name: 'Cimento CP-II (Assentamento)', unit: 'sacos', multiplier: 0.25 },
      { name: 'Cal Hidratada (Liga)', unit: 'sacos', multiplier: 0.25 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.05 },
      { name: 'Ferro para Vergas (Treliça/Cabelo)', unit: 'barras', multiplier: 0.15 },
      { name: 'Aditivo Plastificante (Vedalit)', unit: 'litros', multiplier: 0.05 }
    ]
  },
  {
    category: 'Lajes e Vigas',
    items: [
      { name: 'Laje Pré-moldada (Vigota+Isopor)', unit: 'm²', multiplier: 1.05 },
      { name: 'Concreto Usinado (Caminhão)', unit: 'm³', multiplier: 0.12 },
      { name: 'Malha de Ferro (Pop)', unit: 'un', multiplier: 0.15 },
      { name: 'Caixa de Luz de Laje', unit: 'un', multiplier: 0.1 },
      { name: 'Eletroduto Laranja (Laje)', unit: 'rolos', multiplier: 0.05 }
    ]
  },
  {
    category: 'Impermeabilização',
    items: [
      { name: 'Emulsão Asfáltica (Neutrol)', unit: 'latas 18L', multiplier: 0.02 },
      { name: 'Manta Líquida (Lajes/Áreas frias)', unit: 'balde 18kg', multiplier: 0.03 },
      { name: 'Impermeabilizante Rígido (Viaplus Top)', unit: 'cx 18kg', multiplier: 0.02 },
      { name: 'Tela de Poliéster (Reforço)', unit: 'rolos', multiplier: 0.01 },
      { name: 'Broxa Retangular', unit: 'un', multiplier: 0.01 }
    ]
  },
  {
    category: 'Chapisco e Reboco',
    items: [
      { name: 'Cimento CP-II', unit: 'sacos', multiplier: 0.3 },
      { name: 'Areia Fina', unit: 'm³', multiplier: 0.06 },
      { name: 'Cal Hidratada', unit: 'sacos', multiplier: 0.25 },
      { name: 'Aditivo Impermeabilizante (Vedacit)', unit: 'litros', multiplier: 0.08 },
      { name: 'Tela de Galinheiro (Reforço)', unit: 'rolos', multiplier: 0.01 }
    ]
  },
  {
    category: 'Contrapiso',
    items: [
      { name: 'Cimento CP-II', unit: 'sacos', multiplier: 0.15 },
      { name: 'Areia Média', unit: 'm³', multiplier: 0.05 },
      { name: 'Bianco (Aderência)', unit: 'balde', multiplier: 0.01 }
    ]
  },
  {
    category: 'Telhado',
    items: [
      { name: 'Telha (Cerâmica/Concreto)', unit: 'un', multiplier: 17 }, 
      { name: 'Viga de Madeira (Peroba/Garapeira) 6x12', unit: 'm', multiplier: 0.6 },
      { name: 'Caibros 5x6', unit: 'm', multiplier: 1.8 },
      { name: 'Ripas', unit: 'm', multiplier: 4.0 },
      { name: 'Prego de Telheiro', unit: 'kg', multiplier: 0.03 },
      { name: 'Manta Térmica (Subcobertura)', unit: 'm²', multiplier: 1.2 },
      { name: 'Caixa D\'água 1000L', unit: 'un', multiplier: 0.01 },
      { name: 'Calhas e Rufos', unit: 'm', multiplier: 0.5 }
    ]
  },
  {
    category: 'Fiação Elétrica',
    items: [
      { name: 'Eletroduto Corrugado 3/4 (Amarelo)', unit: 'rolos', multiplier: 0.15 },
      { name: 'Caixa de Luz 4x2 (Parede)', unit: 'un', multiplier: 0.5 },
      { name: 'Quadro de Distribuição (12/24 din)', unit: 'un', multiplier: 0.01 },
      { name: 'Cabo Flexível 2.5mm (Tomadas)', unit: 'rolos 100m', multiplier: 0.06 },
      { name: 'Cabo Flexível 1.5mm (Iluminação)', unit: 'rolos 100m', multiplier: 0.04 },
      { name: 'Cabo Flexível 6.0mm (Chuveiro)', unit: 'm', multiplier: 0.6 },
      { name: 'Disjuntor Unipolar (10A/16A/20A)', unit: 'un', multiplier: 0.2 },
      { name: 'Disjuntor Bipolar (40A/50A)', unit: 'un', multiplier: 0.03 },
      { name: 'Haste de Aterramento (Cobre)', unit: 'un', multiplier: 0.02 },
      { name: 'Fita Isolante', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Tubulação de Água/Esgoto',
    items: [
      { name: 'Tubo Soldável 25mm (Água Fria)', unit: 'barras 6m', multiplier: 0.3 },
      { name: 'Tubo Soldável 50mm (Alimentação)', unit: 'barras 6m', multiplier: 0.05 },
      { name: 'Tubo Esgoto 100mm (Primário)', unit: 'barras 6m', multiplier: 0.1 },
      { name: 'Tubo Esgoto 40mm/50mm (Secundário)', unit: 'barras 6m', multiplier: 0.2 },
      { name: 'Joelho 90 graus 25mm', unit: 'un', multiplier: 0.8 },
      { name: 'Tê Soldável 25mm', unit: 'un', multiplier: 0.3 },
      { name: 'Cola PVC (Adesivo Plástico)', unit: 'frasco', multiplier: 0.05 },
      { name: 'Registro de Gaveta 3/4 (Geral)', unit: 'un', multiplier: 0.03 },
      { name: 'Registro de Pressão 3/4 (Chuveiro)', unit: 'un', multiplier: 0.03 },
      { name: 'Caixa Sifonada 150x150', unit: 'un', multiplier: 0.04 }
    ]
  },
  {
    category: 'Gesso / Forro',
    items: [
      { name: 'Placa de Gesso 60x60 (Plaquinha)', unit: 'un', multiplier: 3.0 },
      { name: 'Chapa Drywall ST (Standard)', unit: 'chapa', multiplier: 0.4 },
      { name: 'Perfil Canaleta/Tabica', unit: 'un', multiplier: 0.5 },
      { name: 'Arame Galvanizado 18', unit: 'kg', multiplier: 0.02 },
      { name: 'Gesso Cola', unit: 'sacas', multiplier: 0.05 },
      { name: 'Sisal', unit: 'kg', multiplier: 0.01 }
    ]
  },
  {
    category: 'Pisos e Revestimentos',
    items: [
      { name: 'Piso / Porcelanato (Chão)', unit: 'm²', multiplier: 1.15 },
      { name: 'Revestimento (Parede)', unit: 'm²', multiplier: 0.8 },
      { name: 'Argamassa AC-I (Interna)', unit: 'sacos 20kg', multiplier: 0.15 },
      { name: 'Argamassa AC-III (Porcelanato/Externa)', unit: 'sacos 20kg', multiplier: 0.2 },
      { name: 'Rejunte Acrílico/Epóxi', unit: 'kg', multiplier: 0.4 },
      { name: 'Espaçadores e Cunhas (Nivelamento)', unit: 'pacote', multiplier: 0.05 },
      { name: 'Rodapé (Poliestireno ou Cerâmico)', unit: 'm', multiplier: 1.1 }
    ]
  },
  {
    category: 'Marmoraria (Bancadas)',
    items: [
      { name: 'Bancada Cozinha (Granito/Mármore)', unit: 'm²', multiplier: 0.02 },
      { name: 'Bancada Banheiro', unit: 'un', multiplier: 0.025 },
      { name: 'Soleiras (Portas)', unit: 'un', multiplier: 0.08 },
      { name: 'Peitoril (Janelas)', unit: 'un', multiplier: 0.06 },
      { name: 'Cuba de Inox (Cozinha)', unit: 'un', multiplier: 0.01 },
      { name: 'Cuba de Louça (Banheiro)', unit: 'un', multiplier: 0.025 },
      { name: 'Silicone PU (Vedação)', unit: 'tubo', multiplier: 0.02 }
    ]
  },
  {
    category: 'Esquadrias (Janelas/Portas)',
    items: [
      { name: 'Porta de Madeira Completa (Interna)', unit: 'un', multiplier: 0.08 },
      { name: 'Fechadura Interna', unit: 'un', multiplier: 0.08 },
      { name: 'Dobradiças', unit: 'jogo', multiplier: 0.08 },
      { name: 'Janela (Alumínio/Vidro)', unit: 'un', multiplier: 0.06 },
      { name: 'Porta de Entrada (Externa)', unit: 'un', multiplier: 0.01 },
      { name: 'Espuma Expansiva', unit: 'lata', multiplier: 0.05 }
    ]
  },
  {
    category: 'Instalação de Louças e Metais',
    items: [
      { name: 'Vaso Sanitário com Caixa Acoplada', unit: 'un', multiplier: 0.025 },
      { name: 'Assento Sanitário', unit: 'un', multiplier: 0.025 },
      { name: 'Torneira de Banheiro (Misturador)', unit: 'un', multiplier: 0.025 },
      { name: 'Torneira de Cozinha (Bancada/Parede)', unit: 'un', multiplier: 0.01 },
      { name: 'Chuveiro / Ducha', unit: 'un', multiplier: 0.025 },
      { name: 'Kit Acessórios (Toalheiro/Papeleira)', unit: 'kit', multiplier: 0.025 },
      { name: 'Sifão Universal', unit: 'un', multiplier: 0.05 },
      { name: 'Engate Flexível', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Instalação de Luminárias',
    items: [
      { name: 'Conjunto Tomada 10A (Placa+Módulo)', unit: 'un', multiplier: 0.3 },
      { name: 'Conjunto Tomada 20A', unit: 'un', multiplier: 0.1 },
      { name: 'Conjunto Interruptor Simples', unit: 'un', multiplier: 0.1 },
      { name: 'Plafon / Luminária LED', unit: 'un', multiplier: 0.15 },
      { name: 'Lâmpadas', unit: 'un', multiplier: 0.2 }
    ]
  },
  {
    category: 'Pintura Paredes/Tetos',
    items: [
      { name: 'Lixa de Parede (100/150/220)', unit: 'folhas', multiplier: 0.8 },
      { name: 'Selador Acrílico (Fundo)', unit: 'latas 18L', multiplier: 0.03 },
      { name: 'Massa Corrida (Interna)', unit: 'latas 18L', multiplier: 0.08 },
      { name: 'Massa Acrílica (Externa/Úmida)', unit: 'latas 18L', multiplier: 0.02 },
      { name: 'Tinta Acrílica Fosca/Semibrilho', unit: 'latas 18L', multiplier: 0.06 },
      { name: 'Tinta Esmalte (Madeiras/Metais)', unit: 'galão 3.6L', multiplier: 0.02 },
      { name: 'Aguarrás (Solvente)', unit: 'litros', multiplier: 0.05 },
      { name: 'Rolo de Lã', unit: 'un', multiplier: 0.04 },
      { name: 'Trincha / Pincel', unit: 'un', multiplier: 0.04 },
      { name: 'Fita Crepe', unit: 'rolos', multiplier: 0.1 },
      { name: 'Lona Plástica (Proteção Pintura)', unit: 'm', multiplier: 1.0 }
    ]
  },
  {
    category: 'Limpeza Final e Entrega',
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
  'Pedreiro', 
  'Ajudante', 
  'Servente', 
  'Mestre de Obras', 
  'Pintor', 
  'Eletricista', 
  'Encanador / Canalizador', 
  'Gesseiro', 
  'Marceneiro', 
  'Serralheiro', 
  'Vidraceiro', 
  'Arquiteto', 
  'Engenheiro', 
  'Azulejista',
  'Telhadista',
  'Outros'
];

export const STANDARD_SUPPLIER_CATEGORIES = [
  'Material de Construção (Geral)', 
  'Elétrica e Iluminação', 
  'Hidráulica', 
  'Pisos e Revestimentos',
  'Tintas e Pintura', 
  'Madeireira', 
  'Vidraçaria', 
  'Marmoraria', 
  'Locação de Equipamentos',
  'Caçamba / Entulho', 
  'Gesso e Drywall',
  'Outros'
];

export const CONTRACT_TEMPLATES = [
  {
    id: 'EMPREITA',
    title: 'Contrato de Empreitada',
    description: 'Para fechar a obra inteira ou etapas grandes com valor fixo.',
    contentTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE EMPREITADA\n\nCONTRATANTE: [Nome], CPF [CPF]...\nCONTRATADO: [Nome], CPF/CNPJ [CPF/CNPJ]...\n\nOBJETO: O presente contrato tem por objeto a execução dos serviços de [Descrever Serviço] no imóvel situado em [Endereço].\n\nVALOR E PAGAMENTO: O valor total é de R$ [Valor], a ser pago da seguinte forma: [Forma de Pagamento].\n\n[...Texto completo do contrato de empreita...]`
  },
  {
    id: 'MAO_DE_OBRA',
    title: 'Contrato de Mão de Obra',
    description: 'Para serviços específicos sem fornecimento de material.',
    contentTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS (MÃO DE OBRA)\n\nCONTRATANTE: [Nome]...\nCONTRATADO: [Nome]...\n\nCLÁUSULA 1: O Contratado se obriga a prestar serviços de [Função]...\n[...Texto completo...]`
  },
  {
    id: 'DIARIA',
    title: 'Acordo de Diária',
    description: 'Modelo simples para profissionais pagos por dia.',
    contentTemplate: `ACORDO DE TRABALHO POR DIÁRIA\n\nData: [Data]\nValor da Diária: R$ [Valor]\nHorário: De [Início] às [Fim]\nServiço: [Descrição]\n\nAssinatura: ____________________`
  },
  {
    id: 'RECIBO',
    title: 'Recibo de Pagamento',
    description: 'Para comprovar pagamentos feitos à equipe ou fornecedores.',
    contentTemplate: `RECIBO DE PAGAMENTO\n\nRecebi de [Nome do Pagador] a quantia de R$ [Valor] (valor por extenso), referente a [Descrição do Serviço/Material].\n\nData: ___/___/___\n\nAssinatura: __________________________\nNome/CPF: __________________________`
  },
  {
    id: 'ENTREGA',
    title: 'Termo de Entrega de Obra',
    description: 'Documento para finalizar a obra e isentar responsabilidades futuras.',
    contentTemplate: `TERMO DE ENTREGA E ACEITE DE OBRA\n\nDeclaro que recebi a obra situada em [Endereço], executada por [Nome do Profissional], em perfeitas condições e de acordo com o combinado.\n\nData: ___/___/___\n\nAssinatura do Proprietário: __________________________`
  }
];

export const STANDARD_CHECKLISTS = [
  {
    category: '01. Serviços Preliminares e Canteiro',
    items: [
      'Ligação provisória de água e energia solicitada e instalada',
      'Placa da obra (se exigido pela prefeitura) instalada',
      'Barracão e banheiro para operários montados',
      'Tapume de fechamento do terreno executado',
      'Limpeza do terreno (capina e retirada de lixo) realizada',
      'Gabarito da obra (marcação) nivelado e no esquadro',
      'EPIs básicos (Capacete, Botas, Luvas) comprados e distribuídos',
      'Caçamba de entulho posicionada (se necessário)',
      'Documentação (Alvará e Projetos) impressa e disponível na obra'
    ]
  },
  {
    category: '02. Infraestrutura (Fundação)',
    items: [
      'Escavação das estacas/sapatas na profundidade do projeto',
      'Fundo das valas compactado e limpo',
      'Armaduras (ferragem) conferidas (bitola e quantidade)',
      'Espaçadores colocados para garantir o cobrimento do concreto',
      'Concretagem realizada com vibração adequada',
      'Impermeabilização das vigas baldrames executada',
      'Passagem de tubulação de esgoto sob o baldrame verificada',
      'Aterro interno compactado',
      'Lona plástica colocada antes do contrapiso (se houver)'
    ]
  },
  {
    category: '03. Supraestrutura (Paredes e Laje)',
    items: [
      'Impermeabilização da base da alvenaria (primeiras fiadas)',
      'Prumo e nível das paredes conferidos a cada 3 fiadas',
      'Vergas e contravergas instaladas em portas e janelas',
      'Amarração das paredes (cantos e encontros) verificada',
      'Caixas de luz (tomadas/interruptores) chumbadas e niveladas',
      'Eletrodutos (mangueiras) passados sem amassamentos',
      'Encunhamento (aperto) entre parede e viga superior feito',
      'Escoramento da laje (cimbramento) firme e contra-flecha aplicada',
      'Armadura da laje (negativos e distribuição) conferida',
      'Concretagem da laje com cura úmida (molhar) por 7 dias'
    ]
  },
  {
    category: '04. Cobertura e Telhado',
    items: [
      'Madeiramento do telhado tratado contra cupim',
      'Inclinação do telhado conferida conforme a telha',
      'Calhas e rufos instalados e testados com água',
      'Caixa d’água instalada em base elevada e nivelada',
      'Manta térmica (subcobertura) instalada corretamente',
      'Telhas fixadas (parafusadas ou amarradas) contra vento',
      'Vedação das calhas revisada'
    ]
  },
  {
    category: '05. Instalações Hidráulicas',
    items: [
      'Tubulação de água fria/quente testada sob pressão (estanqueidade)',
      'Caimento da tubulação de esgoto (mínimo 1% a 2%) conferido',
      'Tubos de queda de esgoto ventilados',
      'Registros de gaveta (geral) instalados em cada ambiente',
      'Registros de pressão (chuveiro) na altura correta',
      'Caixas sifonadas limpas e com fecho hídrico',
      'Teste de vazamento nos ralos (encher de água)'
    ]
  },
  {
    category: '06. Instalações Elétricas',
    items: [
      'Fiação passada conforme cores padrão (Azul=Neutro, Verde=Terra)',
      'Bitola dos fios conferida (Chuveiro 6mm/10mm, Tomadas 2.5mm)',
      'Aterramento conectado em todas as tomadas',
      'Quadro de distribuição organizado e identificado',
      'Disjuntores dimensionados corretamente (sem superaquecer)',
      'Teste de todas as tomadas e interruptores',
      'Pontos de iluminação centralizados nos ambientes'
    ]
  },
  {
    category: '07. Revestimentos e Pisos',
    items: [
      'Chapisco e reboco curados (secos) antes do revestimento',
      'Contrapiso nivelado e com caimento para ralos',
      'Impermeabilização de áreas molhadas (box, sacada) com teste de 72h',
      'Argamassa correta utilizada (AC-I, AC-II ou AC-III)',
      'Dupla colagem feita em peças grandes (>30x30)',
      'Juntas de dilatação respeitadas conforme fabricante',
      'Recortes de piso escondidos (atrás da porta ou móveis)',
      'Proteção do piso instalado (papelão/gesso) imediata'
    ]
  },
  {
    category: '08. Pintura e Acabamento Final',
    items: [
      'Paredes lixadas e livres de poeira',
      'Selador aplicado antes da massa/tinta',
      'Recortes de teto e rodapé alinhados',
      'Vidros e esquadrias limpos (sem respingos de tinta)',
      'Louças (vaso/pia) fixadas e siliconadas',
      'Metais (torneiras/acabamentos) instalados sem vazamento',
      'Portas e janelas abrindo/fechando suavemente',
      'Limpeza grossa e fina realizada',
      'Retirada de todo entulho e sobra de material'
    ]
  }
];

export const LIFETIME_BONUSES = [
  {
    icon: 'fa-calculator',
    title: 'Calculadoras Avançadas',
    desc: 'Ferramentas exclusivas para cálculo de concreto, telhado e elétrica.'
  },
  {
    icon: 'fa-file-contract',
    title: 'Pacote de Contratos Blindados',
    desc: 'Modelos prontos para evitar dores de cabeça com pedreiros e fornecedores.'
  },
  {
    icon: 'fa-list-check',
    title: 'Checklists de Qualidade',
    desc: 'Listas de verificação passo-a-passo para não deixar passar nada.'
  }
];

