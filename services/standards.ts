
// Standard Libraries for Construction Management

// --- AVATAR CONFIG ---
// INSTRUÇÃO PARA O DESENVOLVEDOR:
// 1. Crie uma pasta chamada 'public' na raiz do projeto (se não existir).
// 2. Coloque sua imagem PNG premium dentro dela.
// 3. Renomeie o arquivo para 'ze.png'.
// O app dará preferência para sua imagem local.
export const ZE_AVATAR = './ze.png';

// Fallback Premium (Estilo 3D Fluent/Memoji)
// Se o arquivo './ze.png' não for encontrado, esta imagem será usada automaticamente.
export const ZE_AVATAR_FALLBACK = 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Construction%20Worker.png';

// --- DICAS DINÂMICAS DO ZÉ ---
export interface ZeTip {
  text: string;
  tag: string;
}

export const ZE_TIPS: ZeTip[] = [
  // GESTÃO E FINANCEIRO
  { tag: 'Financeiro', text: 'Evite adiantamentos integrais de mão de obra. Estabeleça um cronograma físico-financeiro e realize pagamentos mediante medição de serviço executado.' },
  { tag: 'Gestão', text: 'Material faltando para a obra mais que chuva. Verifique o estoque 2 dias antes da próxima etapa começar para não pagar diária de pedreiro parado.' },
  { tag: 'Contrato', text: 'O combinado não sai caro. Sempre faça um contrato escrito descrevendo exatamente o que será feito e o que NÃO está incluso no orçamento.' },
  { tag: 'Economia', text: 'Comprar tudo de uma vez pode parecer bom, mas o cimento empedra e o piso quebra. Compre materiais brutos conforme a demanda da etapa.' },
  
  // TÉCNICO E ESTRUTURA
  { tag: 'Estrutura', text: 'Para garantir a durabilidade, respeite a cura do concreto. Molhe a laje ou pilares por pelo menos 7 dias (cura úmida) para evitar trincas.' },
  { tag: 'Instalações', text: 'Tire fotos das paredes com a tubulação hidráulica e elétrica antes de rebocar. Isso é um mapa do tesouro para evitar furar canos no futuro.' },
  { tag: 'Impermeabilização', text: 'Não economize na impermeabilização dos baldrames e áreas molhadas. Resolver infiltração depois de pronto custa 5x mais caro.' },
  { tag: 'Elétrica', text: 'Nunca use fio mais fino que o especificado para o chuveiro (geralmente 6mm ou 10mm). Fio fino esquenta, gasta mais energia e pode causar incêndio.' },
  
  // ACABAMENTO E FINALIZAÇÃO
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
    steps: ['Massa Corrida e Lixamento', 'Pintura Paredes/Tetos', 'Instalação de Louças e Metais', 'Instalação de Luminárias', 'Limpeza Final e Entrega']
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
      'Instalação de Luminárias', 'Limpeza Final e Entrega'
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
  items: {name: string, unit: string, multiplier?: number}[];
}

// FULL BACKUP CATALOG COM ESTIMATIVAS INTELIGENTES (baseadas na Área Total do Piso)
export const FULL_MATERIAL_PACKAGES: MaterialCatalog[] = [
  {
    category: 'Fundação',
    items: [
      { name: 'Cimento CP-II', unit: 'sacos', multiplier: 0.3 }, // Ex: 0.3 saco por m2 de obra (média fundação)
      { name: 'Areia Média', unit: 'm³', multiplier: 0.04 },
      { name: 'Brita 1', unit: 'm³', multiplier: 0.04 },
      { name: 'Pedra de Mão (Rachão)', unit: 'm³', multiplier: 0.02 },
      { name: 'Vergalhão 3/8 (10mm)', unit: 'barras', multiplier: 0.5 },
      { name: 'Vergalhão 5/16 (8mm)', unit: 'barras', multiplier: 0.5 },
      { name: 'Estribo 4.2mm (Pronto)', unit: 'un', multiplier: 5 },
      { name: 'Arame Recozido', unit: 'kg', multiplier: 0.05 },
      { name: 'Tábua de Pinus (Caixaria)', unit: 'dz', multiplier: 0.1 },
      { name: 'Prego 17x21 (Cabeça dupla)', unit: 'kg', multiplier: 0.05 },
      { name: 'Impermeabilizante betuminoso', unit: 'latas', multiplier: 0.05 }
    ]
  },
  {
    category: 'Alvenaria',
    items: [
      { name: 'Tijolo Cerâmico 8 furos', unit: 'milheiro', multiplier: 0.07 }, // Aprox 70 tijolos/m2 de piso (considerando paredes)
      { name: 'Bloco de Concreto Estrutural', unit: 'un', multiplier: 0 },
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
      { name: 'Telha Cerâmica/Concreto', unit: 'un', multiplier: 16 }, // ~16 telhas por m2 de telhado
      { name: 'Viga de Madeira (Peroba/Garapeira)', unit: 'm', multiplier: 0.5 },
      { name: 'Caibros', unit: 'm', multiplier: 1.5 },
      { name: 'Ripas', unit: 'm', multiplier: 3.5 },
      { name: 'Prego de Telheiro', unit: 'kg', multiplier: 0.02 },
      { name: 'Manta Térmica (Subcobertura)', unit: 'rolos', multiplier: 0.02 },
      { name: 'Caixa D\'água', unit: 'un', multiplier: 0 } // Item fixo
    ]
  },
  {
    category: 'Elétrica',
    items: [
      { name: 'Eletroduto Corrugado Amarelo (Flexível)', unit: 'rolos', multiplier: 0.1 },
      { name: 'Caixa de Luz 4x2 (Parede)', unit: 'un', multiplier: 0.4 },
      { name: 'Caixa de Luz 4x4', unit: 'un', multiplier: 0.1 },
      { name: 'Cabo Flexível 2.5mm (Tomadas)', unit: 'rolos', multiplier: 0.05 },
      { name: 'Cabo Flexível 1.5mm (Iluminação)', unit: 'rolos', multiplier: 0.03 },
      { name: 'Cabo Flexível 6mm (Chuveiro)', unit: 'm', multiplier: 0.5 },
      { name: 'Disjuntor Monopolar', unit: 'un', multiplier: 0.15 },
      { name: 'Quadro de Distribuição', unit: 'un', multiplier: 0 },
      { name: 'Fita Isolante', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Hidráulica',
    items: [
      { name: 'Tubo PVC Soldável 25mm (Água)', unit: 'barras', multiplier: 0.2 },
      { name: 'Tubo Esgoto 100mm', unit: 'barras', multiplier: 0.1 },
      { name: 'Tubo Esgoto 40mm', unit: 'barras', multiplier: 0.15 },
      { name: 'Joelho 90 graus 25mm', unit: 'un', multiplier: 0.5 },
      { name: 'Luva de correr', unit: 'un', multiplier: 0.2 },
      { name: 'Cola para PVC', unit: 'tubo', multiplier: 0.05 },
      { name: 'Registro de Gaveta (Geral)', unit: 'un', multiplier: 0.02 },
      { name: 'Registro de Pressão (Chuveiro)', unit: 'un', multiplier: 0.03 },
      { name: 'Caixa Sifonada', unit: 'un', multiplier: 0.05 }
    ]
  },
  {
    category: 'Acabamento',
    items: [
      { name: 'Piso / Porcelanato', unit: 'm²', multiplier: 1.15 }, // +15% quebra
      { name: 'Argamassa AC-II ou AC-III', unit: 'sacos', multiplier: 0.25 }, // ~4kg/m2 -> 1 saco faz 5m2 -> 0.2 saco/m2
      { name: 'Rejunte', unit: 'kg', multiplier: 0.3 },
      { name: 'Espaçadores / Niveladores', unit: 'pct', multiplier: 0.05 },
      { name: 'Rodapé', unit: 'm', multiplier: 1.1 } // Metragem linear aprox igual m2 em cômodos quadrados
    ]
  },
  {
    category: 'Pintura',
    items: [
      { name: 'Lixa de Parede 120/150', unit: 'folhas', multiplier: 0.5 },
      { name: 'Selador Acrílico', unit: 'latas', multiplier: 0.02 },
      { name: 'Massa Corrida (Interna)', unit: 'latas', multiplier: 0.05 },
      { name: 'Tinta Acrílica Fosca/Acetinada', unit: 'latas', multiplier: 0.05 }, // ~3m de parede para cada 1m de chão.
      { name: 'Rolo de Lã', unit: 'un', multiplier: 0.02 },
      { name: 'Pincel / Trincha', unit: 'un', multiplier: 0.02 },
      { name: 'Fita Crepe', unit: 'rolos', multiplier: 0.05 },
      { name: 'Lona Plástica (Proteção)', unit: 'm', multiplier: 1 }
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

// --- CHECKLISTS ENRIQUECIDOS (ANTI-ERRO) ---
export const STANDARD_CHECKLISTS = [
  {
    category: '01. Início de Obra e Canteiro',
    items: [
      'Água e Luz provisórias ligadas e funcionando',
      'Tapume ou fechamento seguro do perímetro',
      'Banheiro para operários limpo e funcionando',
      'Local de armazenamento de cimento (seco, alto e ventilado)',
      'Projetos impressos e plastificados na obra (Arquitetônico, Estrutural)',
      'EPIs básicos disponíveis (Capacete, Luva, Bota, Óculos)',
      'Placa da obra instalada (se exigido pela prefeitura)',
      'Caçamba ou local definido para descarte de entulho'
    ]
  },
  {
    category: '02. Fundação e Impermeabilização (Crítico)',
    items: [
      'Conferir gabarito e eixos das paredes',
      'Verificar profundidade e largura das sapatas/brocas',
      'Checar espaçadores na ferragem (ferro não pode encostar na terra)',
      'Aplicação de tinta betuminosa (piche) em 100% da viga baldrame',
      'Impermeabilização negativa (primeiras 3 fiadas de tijolo)',
      'Conferir prumo e alinhamento dos arranques dos pilares'
    ]
  },
  {
    category: '03. Alvenaria e Paredes',
    items: [
      'Conferir esquadro dos cômodos (trena nos cantos)',
      'Verificar prumo (parede em pé) e nível (fiadas retas)',
      'Checar amarração dos tijolos nos cantos (trançado)',
      'Vergas e contravergas instaladas em janelas e portas (evita trinca 45º)',
      'Encunhamento (aperto) entre parede e viga superior feito corretamente',
      'Limpeza de restos de massa no rodapé das paredes'
    ]
  },
  {
    category: '04. Antes da Concretagem (Laje/Vigas)',
    items: [
      'Conferir escoramento (se está firme, alinhado e travado)',
      'Verificar caixinhas de luz (se estão bem presas e vedadas)',
      'Checar tubulação elétrica (conduítes não amassados/quebrados)',
      'Verificar espaçadores da ferragem (ferro não pode encostar na madeira)',
      'Molhar as formas de madeira abundantemente antes do concreto',
      'Conferir nível da laje (mestras) para garantir espessura correta',
      'Verificar passantes de hidráulica/esgoto (para não furar laje depois)'
    ]
  },
  {
    category: '05. Telhado e Cobertura',
    items: [
      'Verificar alinhamento das telhas (galga correta)',
      'Conferir fixação das telhas (parafusos ou amarração contra vento)',
      'Checar caimento das calhas (jogar água para testar)',
      'Verificar vedação dos rufos na parede (silicone ou argamassa)',
      'Teste de estanqueidade (jogar água com mangueira simulando chuva)',
      'Manta térmica instalada sem rasgos (se houver)'
    ]
  },
  {
    category: '06. Hidráulica e Esgoto',
    items: [
      'Tirar fotos das paredes com tubulação antes de rebocar (Mapa da Mina)',
      'Teste de pressão (deixar rede de água pressurizada por 24h)',
      'Teste de vazão nos ralos (jogar balde d\'água)',
      'Verificar caimento do piso do box para o ralo',
      'Conferir altura dos pontos de esgoto (pia, tanque, vaso)',
      'Colocar plugues/tampões em todos os canos abertos (evita entulho dentro)'
    ]
  },
  {
    category: '07. Elétrica',
    items: [
      'Conferir altura das tomadas (Baixa: 30cm, Média: 1.20m, Alta: 2.20m)',
      'Verificar se há circuitos separados (Chuveiro, Ar, Cozinha)',
      'Testar todas as tomadas com equipamento (multímetro ou testador)',
      'Identificar disjuntores no quadro com etiquetas',
      'Conferir aterramento (fio terra) em todas as tomadas',
      'Verificar se cabos estão estanhados ou com terminais nas pontas'
    ]
  },
  {
    category: '08. Contrapiso e Revestimentos',
    items: [
      'Verificar caimento de água em áreas molhadas (banheiro, sacada, lavanderia)',
      'Teste do som cavo (bater levemente com cabo de vassoura no piso)',
      'Conferir alinhamento das juntas (rejunte)',
      'Verificar recortes (se estão bem feitos e em locais escondidos)',
      'Checar se há peças lascadas ou riscadas',
      'Teste de escoamento no box (água não pode empoçar)'
    ]
  },
  {
    category: '09. Esquadrias (Portas e Janelas)',
    items: [
      'Abrir e fechar todas as folhas (movimento suave, sem agarrar)',
      'Testar trincos e fechaduras (chave entrando fácil)',
      'Verificar vedação (borrachas/silicone) contra chuva',
      'Conferir se estão no prumo e nível',
      'Verificar riscos nos vidros ou perfis de alumínio'
    ]
  },
  {
    category: '10. Pintura e Acabamento Final',
    items: [
      'Verificar uniformidade da cor (sem manchas de rolo)',
      'Checar recortes no teto e rodapé (linha reta)',
      'Verificar se respingou tinta em espelhos, vidros ou piso',
      'Testar interruptores e lâmpadas',
      'Conferir se louças e metais estão firmes (torneira bamba?)',
      'Limpeza grossa removida (restos de massa, gesso)'
    ]
  },
  {
    category: '11. Vistoria Final de Entrega (Chaves)',
    items: [
      'Levar balde, lâmpada e carregador de celular para testes',
      'Abrir todas as torneiras simultaneamente (checar pressão)',
      'Acionar todas as descargas',
      'Jogar água em todas as áreas laváveis (sacada/box)',
      'Testar todas as chaves em todas as portas',
      'Olhar contra a luz paredes e pisos (buscar defeitos)',
      'Verificar manual do proprietário e garantias dos equipamentos'
    ]
  }
];
