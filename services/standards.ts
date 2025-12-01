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

// --- STANDARD CHECKLISTS (ANTI-DOR DE CABEÇA) ---
export const STANDARD_CHECKLISTS = [
  {
    category: 'Impermeabilização e Áreas Molhadas',
    items: [
      'Teste de Caimento (Poça d\'água): Jogue um balde d\'água no box e sacadas. A água deve ir sozinha para o ralo. Se empoçar, NÃO aceite o piso.',
      'Teste de Estanqueidade: Tampe os ralos e deixe o banheiro com 2cm de água por 48h. Verifique o teto do andar de baixo ou umidade nas paredes vizinhas.',
      'Rodapé da Impermeabilização: O produto deve subir pelo menos 30cm nas paredes do box, não só no chão.',
      'Ralos Protegidos: Verifique se os ralos estão tapados durante a obra para não entrar cimento e entupir o cano.'
    ]
  },
  {
    category: 'Pisos e Revestimentos',
    items: [
      'Teste do Som Oco: Bata levemente com o cabo de uma chave em cada peça de piso. Som oco = peça solta que vai quebrar em breve.',
      'Dente no Piso (Nivelamento): Passe uma moeda de 1 real entre dois pisos. Se ela travar no degrau, o nivelamento está ruim.',
      'Recortes nos Cantos: Verifique se os pedaços pequenos de piso (recortes) ficaram escondidos (atrás da porta, embaixo de armários) e não na entrada.',
      'Proteção Pós-Instalação: O piso novo deve ser coberto com papelão ondulado ou lona para não riscar na pintura.'
    ]
  },
  {
    category: 'Instalações Elétricas',
    items: [
      'Identificação 110v/220v: As tomadas 220v estão marcadas (fita vermelha/etiqueta) dentro da caixinha? Isso evita queimar aparelhos na mudança.',
      'Fio Terra: Abra uma tomada aleatória. O fio verde (terra) está lá e conectado? É essencial para segurança.',
      'Aperto no Quadro: Peça para o eletricista reapertar todos os parafusos do quadro de luz no final. Fio solto causa incêndio.',
      'Teste de Carga: Ligue o chuveiro e o secador juntos. O disjuntor não pode cair.'
    ]
  },
  {
    category: 'Hidráulica e Esgoto',
    items: [
      'Teste de Pressão: Abra todas as torneiras e chuveiros ao mesmo tempo. A água sai com força suficiente?',
      'Mau Cheiro (Sifão): Verifique se embaixo de cada pia tem um sifão (aquele tubo curvo) com água parada na curva. Sem isso, o cheiro de esgoto volta.',
      'Vazamento Relógio: Feche todas as torneiras e olhe o hidrômetro. Se o ponteiro/roleta girar, tem vazamento escondido.',
      'Registro Geral: Feche o registro geral e veja se a água da casa realmente corta.'
    ]
  },
  {
    category: 'Portas, Janelas e Vidros',
    items: [
      'Teste da "Porta Fantasma": Abra a porta e solte. Ela deve ficar parada. Se abrir ou fechar sozinha, está fora de prumo.',
      'Vedação de Janela: Jogue água com mangueira na janela fechada (de fora para dentro). Não pode entrar nenhuma gota.',
      'Riscos nos Vidros: Olhe os vidros contra a luz do sol para ver se a limpeza da obra não riscou o material.',
      'Chaves: Teste todas as chaves, trancando e destrancando por dentro e por fora.'
    ]
  }
];
