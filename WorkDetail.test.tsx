/// <reference types="jest" />
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as ReactRouter from 'react-router-dom';
import WorkDetail from './WorkDetail.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts'; // Importe supabase para mocking de upload
import { PlanType, WorkStatus, StepStatus, ExpenseCategory, FileCategory } from '../types.ts';
import { WORK_TEMPLATES } from '../services/standards.ts'; // Importe para ter acesso aos templates

// Mockando módulos externos
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
  useSearchParams: jest.fn(),
  useMatch: jest.fn(),
}));
jest.mock('../contexts/AuthContext.tsx', () => ({
  useAuth: jest.fn(),
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));
jest.mock('../services/db.ts');
jest.mock('../services/supabase.ts', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => ({ data: { path: 'mock/path/image.png' }, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://mockurl.com/image.png' } })),
        remove: jest.fn(() => ({ data: {}, error: null })),
      })),
    },
  },
}));


// --- Mocks de Dados ---
const mockUser = {
  id: 'user-123',
  name: 'Teste User',
  email: 'test@example.com',
  plan: PlanType.MENSAL, // Default to a basic plan for most tests
  isTrial: false,
  subscriptionExpiresAt: new Date(Date.now() + 86400000).toISOString(), // Expires tomorrow
};

const mockWork = {
  id: 'work-1',
  userId: 'user-123',
  name: 'Obra de Teste',
  address: 'Rua Teste, 123',
  budgetPlanned: 100000,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  area: 100,
  floors: 1,
  bedrooms: 3,
  bathrooms: 2,
  kitchens: 1,
  livingRooms: 1,
  hasLeisureArea: false,
  notes: 'Notas da obra',
  status: WorkStatus.IN_PROGRESS,
};

const mockSteps = [
  { id: 'step-1', workId: 'work-1', name: 'Fundação', startDate: '2024-01-10', endDate: '2024-01-20', status: StepStatus.COMPLETED, isDelayed: false, orderIndex: 1 },
  { id: 'step-2', workId: 'work-1', name: 'Alvenaria', startDate: '2024-01-21', endDate: '2024-02-15', status: StepStatus.IN_PROGRESS, isDelayed: false, orderIndex: 2 },
  { id: 'step-3', workId: 'work-1', name: 'Telhado', startDate: '2024-02-16', endDate: '2024-03-10', status: StepStatus.NOT_STARTED, isDelayed: true, orderIndex: 3 }, // Delayed step
];

const mockMaterials = [
  { id: 'mat-1', workId: 'work-1', userId: 'user-123', name: 'Cimento', brand: 'Marca Cimento', plannedQty: 100, purchasedQty: 80, unit: 'saco', stepId: 'step-2', category: 'Estrutura', totalCost: 1600 },
  { id: 'mat-2', workId: 'work-1', userId: 'user-123', name: 'Areia', brand: '', plannedQty: 50, purchasedQty: 50, unit: 'm³', stepId: 'step-1', category: 'Estrutura', totalCost: 1000 },
  { id: 'mat-3', workId: 'work-1', userId: 'user-123', name: 'Telhas', brand: 'Marca Telha', plannedQty: 500, purchasedQty: 0, unit: 'un', stepId: 'step-3', category: 'Cobertura', totalCost: 0 },
];

const mockExpenses = [
  { id: 'exp-1', workId: 'work-1', description: 'Compra de cimento', amount: 1600, paidAmount: 1600, quantity: 80, date: '2024-01-25', category: ExpenseCategory.MATERIAL, relatedMaterialId: 'mat-1', stepId: 'step-2', workerId: undefined, supplierId: 'sup-1', totalAgreed: 1600 },
  { id: 'exp-2', workId: 'work-1', description: 'Pagamento pedreiro', amount: 2000, paidAmount: 1000, quantity: 1, date: '2024-01-30', category: ExpenseCategory.LABOR, relatedMaterialId: undefined, stepId: 'step-2', workerId: 'worker-1', supplierId: undefined, totalAgreed: 2000 },
  { id: 'exp-3', workId: 'work-1', description: 'Taxa prefeitura', amount: 500, paidAmount: 500, quantity: 1, date: '2024-01-05', category: ExpenseCategory.PERMITS, relatedMaterialId: undefined, stepId: 'step-1', workerId: undefined, supplierId: undefined, totalAgreed: 500 },
];

const mockWorkers = [
  { id: 'worker-1', userId: 'user-123', workId: 'work-1', name: 'João Pedreiro', role: 'Pedreiro', phone: '11987654321', dailyRate: 200, notes: 'Ótimo profissional' },
];

const mockSuppliers = [
  { id: 'sup-1', userId: 'user-123', workId: 'work-1', name: 'Construmais', category: 'Material de Construção', phone: '11123456789', email: 'contato@construmais.com', address: 'Rua A, 1', notes: '' },
];

const mockPhotos = [
  { id: 'photo-1', workId: 'work-1', url: 'http://mockurl.com/photo1.jpg', description: 'Início da fundação', date: '2024-01-10', type: 'PROGRESS' },
];

const mockFiles = [
  { id: 'file-1', workId: 'work-1', name: 'Planta Baixa', category: FileCategory.ARCHITECTURAL, url: 'http://mockurl.com/planta.pdf', type: 'application/pdf', date: '2023-12-01' },
];

const mockChecklists = [
  {
    id: 'chk-1', workId: 'work-1', name: 'Checklist de Fundação', category: 'Fundações',
    items: [
      { id: 'item-1-1', text: 'Verificar nível', checked: true },
      { id: 'item-1-2', text: 'Conferir prumo', checked: false },
    ],
  },
];


// --- Configuração dos Mocks antes de cada teste ---
beforeEach(() => {
  // Limpa e reseta todos os mocks antes de cada teste
  jest.clearAllMocks();

  // Mocks padrão para useAuth
  (useAuth as jest.Mock).mockReturnValue({
    user: mockUser,
    authLoading: false,
    isUserAuthFinished: true,
    refreshUser: jest.fn(),
    isSubscriptionValid: true, // Assume que o usuário tem uma assinatura válida por padrão
    trialDaysRemaining: null,
  });

  // Mocks padrão para react-router-dom
  (ReactRouter.useParams as jest.Mock).mockReturnValue({ id: mockWork.id });
  (ReactRouter.useNavigate as jest.Mock).mockReturnValue(jest.fn());
  (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '' });
  (ReactRouter.useSearchParams as jest.Mock).mockReturnValue([new URLSearchParams()]);
  (ReactRouter.useMatch as jest.Mock).mockImplementation((path) => {
    if (path === '/work/:id') {
      return {
        params: { id: mockWork.id },
        pathname: `/work/${mockWork.id}`,
        pattern: { path: '/work/:id' },
      };
    }
    return null;
  });

  // Mocks padrão para dbService
  (dbService.getWorkById as jest.Mock).mockResolvedValue(mockWork);
  (dbService.getSteps as jest.Mock).mockResolvedValue(mockSteps);
  (dbService.getMaterials as jest.Mock).mockResolvedValue(mockMaterials);
  (dbService.getExpenses as jest.Mock).mockResolvedValue(mockExpenses);
  (dbService.getWorkers as jest.Mock).mockResolvedValue(mockWorkers);
  (dbService.getSuppliers as jest.Mock).mockResolvedValue(mockSuppliers);
  (dbService.getPhotos as jest.Mock).mockResolvedValue(mockPhotos);
  (dbService.getFiles as jest.Mock).mockResolvedValue(mockFiles);
  (dbService.getContractTemplates as jest.Mock).mockResolvedValue(WORK_TEMPLATES.filter(t => t.id === 'CONSTRUCAO')); // Just a basic contract mock
  (dbService.getChecklists as jest.Mock).mockResolvedValue(mockChecklists);
  (dbService.ensureMaterialsForWork as jest.Mock).mockResolvedValue(undefined); // Mock this to do nothing
});

// --- Testes para as funções de formatação monetária (fora do componente) ---
describe('Currency Formatting Helpers', () => {
  // Funções formatInputReal e parseInputReal do WorkDetail.tsx (copiadas para teste isolado)
  const formatInputReal = (rawNumericString: string): string => {
    if (!rawNumericString) return '';
    
    const cleanedInput = rawNumericString.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanedInput);
    
    if (isNaN(num)) {
        return rawNumericString;
    }
    
    const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (rawNumericString.includes(',') && !rawNumericString.split(',')[1]) {
      return formatted.replace(',00', ',');
    }
    if (rawNumericString.endsWith(',') && formatted.endsWith(',00')) {
      return formatted.slice(0, -2);
    }
    if (rawNumericString.endsWith(',0')) {
        return formatted.slice(0, -1);
    }

    return formatted;
  };

  const parseInputReal = (displayString: string): string => {
    if (!displayString) return '';

    let cleaned = displayString.replace(/\./g, '');
    cleaned = cleaned.replace(',', '.');
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';

    return num.toFixed(2);
  };

  it('should format integer to BRL with two decimal places', () => {
    expect(formatInputReal("1000")).toBe("1.000,00");
    expect(formatInputReal("123")).toBe("123,00");
    expect(formatInputReal("0")).toBe("0,00");
  });

  it('should format decimal to BRL correctly', () => {
    expect(formatInputReal("123.45")).toBe("123,45");
    expect(formatInputReal("123.4")).toBe("123,40"); // toFixed(2) is applied by toLocaleString
    expect(formatInputReal("1234567.89")).toBe("1.234.567,89");
  });

  it('should handle typing a comma and one decimal place', () => {
    expect(formatInputReal("123,")).toBe("123,"); // User is typing, keeps comma
    expect(formatInputReal("123,0")).toBe("123,0"); // User is typing, keeps one zero
    expect(formatInputReal("123,00")).toBe("123,00");
  });

  it('should handle empty string', () => {
    expect(formatInputReal("")).toBe("");
  });

  it('should parse formatted string back to raw numeric string', () => {
    expect(parseInputReal("1.000,00")).toBe("1000.00");
    expect(parseInputReal("123,45")).toBe("123.45");
    expect(parseInputReal("1.234.567,89")).toBe("1234567.89");
    expect(parseInputReal("123,")).toBe("123.00"); // Should parse to fixed 2 decimals
    expect(parseInputReal("123,0")).toBe("123.00");
  });

  it('should parse non-numeric input to empty string', () => {
    expect(parseInputReal("abc")).toBe("");
    expect(parseInputReal("-")).toBe("");
    expect(parseInputReal(",")).toBe("");
  });
});


// --- Testes do Componente WorkDetail ---
describe('WorkDetail Component', () => {
  // Teste de renderização inicial
  it('should render loading state initially', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, authLoading: true, isUserAuthFinished: false });
    render(<WorkDetail />);
    expect(screen.getByText('Carregando dados da obra...')).toBeInTheDocument();
    expect(screen.getByRole('img', { hidden: true })).toHaveClass('fa-circle-notch fa-spin');
  });

  it('should render work details after loading', async () => {
    render(<WorkDetail />);

    // Espera o carregamento dos dados e a renderização do componente
    await waitFor(() => {
      expect(screen.getByText('Obra: Obra de Teste')).toBeInTheDocument();
      expect(screen.getByText('Rua Teste, 123')).toBeInTheDocument();
      expect(screen.getByText('Cronograma')).toBeInTheDocument(); // Default tab
    });

    // Verifica se os dados do resumo da obra são exibidos
    expect(screen.getByText('1')).toBeInTheDocument(); // Assuming 1 completed steps
    expect(screen.getByText('Etapas Concluídas')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Assuming 1 in progress steps
    expect(screen.getByText('Etapas Em Andamento')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Assuming 1 delayed step
    expect(screen.getByText('Etapas Atrasadas')).toBeInTheDocument();
    
    // Check material summary
    expect(screen.getByText('2')).toBeInTheDocument(); // Pending Materials (mat-1 is 80/100, mat-3 is 0/500)
    expect(screen.getByText('Materiais Pendentes')).toBeInTheDocument();

    // Check financial summary
    expect(screen.getByText('R$ 100.000,00')).toBeInTheDocument(); // Orçamento Planejado
    expect(screen.getByText('R$ 4.100,00')).toBeInTheDocument(); // Gasto Total (1600 + 2000 + 500)
    expect(screen.getByText('R$ 95.900,00')).toBeInTheDocument(); // Balanço (100000 - 4100)
  });

  it('should redirect to dashboard if work not found or not owned', async () => {
    (dbService.getWorkById as jest.Mock).mockResolvedValue(null); // Work not found
    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    render(<WorkDetail />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should navigate between tabs correctly and update URL', async () => {
    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Cronograma')).toBeInTheDocument());

    // Click on 'Materiais' tab
    fireEvent.click(screen.getByRole('button', { name: /materiais/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/work/${mockWork.id}?tab=MATERIAIS`, {"replace": true});
    });

    // Simulate URL change (as navigate doesn't re-render immediately in tests)
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=MATERIAIS' });
    render(<WorkDetail />); // Re-render with new location

    await waitFor(() => {
      expect(screen.getByText('Materiais')).toBeInTheDocument();
      expect(screen.getByText('Cimento')).toBeInTheDocument(); // Material specific data
    });

    // Click on 'Financeiro' tab
    fireEvent.click(screen.getByRole('button', { name: /financeiro/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/work/${mockWork.id}?tab=FINANCEIRO`, {"replace": true});
    });
    
    // Simulate URL change
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=FINANCEIRO' });
    render(<WorkDetail />);

    await waitFor(() => {
      expect(screen.getByText('Financeiro')).toBeInTheDocument();
      expect(screen.getByText('Compra de cimento')).toBeInTheDocument(); // Expense specific data
    });
  });


  // --- Testes de CRUD para Etapas ---
  it('should add a new step', async () => {
    (dbService.addStep as jest.Mock).mockResolvedValue({ ...mockSteps[0], id: 'new-step-id', name: 'Nova Etapa', orderIndex: mockSteps.length + 1 });
    (dbService.getSteps as jest.Mock).mockResolvedValue([...mockSteps, { ...mockSteps[0], id: 'new-step-id', name: 'Nova Etapa', orderIndex: mockSteps.length + 1 }]);

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Cronograma')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nova etapa/i })); // Click 'Nova Etapa' button
    await waitFor(() => expect(screen.getByText('Adicionar Nova Etapa')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nome da Etapa'), { target: { value: 'Nova Etapa' } });
    fireEvent.change(screen.getByLabelText('Data de Início'), { target: { value: '2024-04-01' } });
    fireEvent.change(screen.getByLabelText('Data de Término'), { target: { value: '2024-04-10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Etapa' }));

    await waitFor(() => {
      expect(dbService.addStep).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nova Etapa' }));
      expect(dbService.getSteps).toHaveBeenCalledTimes(2); // Initial load + after add
      expect(screen.queryByText('Adicionar Nova Etapa')).not.toBeInTheDocument(); // Modal should close
    });
  });

  it('should edit an existing step', async () => {
    (dbService.updateStep as jest.Mock).mockResolvedValue({ ...mockSteps[0], name: 'Fundação Editada' });
    (dbService.getSteps as jest.Mock).mockResolvedValue([{ ...mockSteps[0], name: 'Fundação Editada', orderIndex: 1 }, ...mockSteps.slice(1)]);

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Cronograma')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Fundação')); // Click on a step card to open edit modal
    await waitFor(() => expect(screen.getByText('Editar Etapa')).toBeInTheDocument());

    const nameInput = screen.getByLabelText('Nome da Etapa');
    fireEvent.change(nameInput, { target: { value: 'Fundação Editada' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => {
      expect(dbService.updateStep).toHaveBeenCalledWith(expect.objectContaining({ id: 'step-1', name: 'Fundação Editada' }));
      expect(dbService.getSteps).toHaveBeenCalledTimes(2); // Initial load + after update
      expect(screen.queryByText('Editar Etapa')).not.toBeInTheDocument(); // Modal should close
    });
  });

  it('should delete a step', async () => {
    (dbService.deleteStep as jest.Mock).mockResolvedValue(undefined);
    (dbService.getSteps as jest.Mock).mockResolvedValue(mockSteps.slice(1)); // Return remaining steps

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Cronograma')).toBeInTheDocument());

    fireEvent.click(screen.getAllByLabelText(/excluir etapa/i)[0]); // Click delete icon of the first step
    await waitFor(() => expect(screen.getByText('Excluir Etapa')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(dbService.deleteStep).toHaveBeenCalledWith('step-1', mockWork.id);
      expect(dbService.getSteps).toHaveBeenCalledTimes(2); // Initial load + after delete
      expect(screen.queryByText('Excluir Etapa')).not.toBeInTheDocument(); // Modal should close
    });
  });

  // --- Testes de CRUD para Materiais ---
  it('should add a new material', async () => {
    (dbService.addMaterial as jest.Mock).mockResolvedValue({ ...mockMaterials[0], id: 'new-mat-id', name: 'Tijolo' });
    (dbService.getMaterials as jest.Mock).mockResolvedValue([...mockMaterials, { ...mockMaterials[0], id: 'new-mat-id', name: 'Tijolo' }]);

    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=MATERIAIS' });

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Materiais')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /novo material/i }));
    await waitFor(() => expect(screen.getByText('Adicionar Novo Material')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nome do Material'), { target: { value: 'Tijolo' } });
    fireEvent.change(screen.getByLabelText('Qtd. Planejada'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'un' } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Material' }));

    await waitFor(() => {
      expect(dbService.addMaterial).toHaveBeenCalledWith(mockUser.id, expect.objectContaining({ name: 'Tijolo' }));
      expect(dbService.getMaterials).toHaveBeenCalledTimes(2); // Initial load + after add
      expect(screen.queryByText('Adicionar Novo Material')).not.toBeInTheDocument();
    });
  });

  it('should register a material purchase with correct currency formatting', async () => {
    (dbService.registerMaterialPurchase as jest.Mock).mockResolvedValue({ ...mockMaterials[0], purchasedQty: 90, totalCost: 1800 });
    (dbService.getMaterials as jest.Mock).mockResolvedValue([{ ...mockMaterials[0], purchasedQty: 90, totalCost: 1800 }, ...mockMaterials.slice(1)]);

    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=MATERIAIS' });

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Materiais')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Cimento')); // Click on material card
    await waitFor(() => expect(screen.getByText('Registrar Compra')).toBeInTheDocument());

    const purchaseQtyInput = screen.getByLabelText('Qtd. da Compra');
    const purchaseCostInput = screen.getByLabelText('Custo da Compra (R$)');

    fireEvent.change(purchaseQtyInput, { target: { value: '10' } });
    expect(purchaseQtyInput).toHaveValue(10); // Still number type input for quantity

    // Testing currency input behavior
    fireEvent.change(purchaseCostInput, { target: { value: '20' } });
    expect(purchaseCostInput).toHaveValue('20,00');
    fireEvent.change(purchaseCostInput, { target: { value: '2000' } });
    expect(purchaseCostInput).toHaveValue('2.000,00');
    fireEvent.change(purchaseCostInput, { target: { value: '2000,' } }); // User types comma
    expect(purchaseCostInput).toHaveValue('2.000,');
    fireEvent.change(purchaseCostInput, { target: { value: '2000,5' } }); // User types one decimal
    expect(purchaseCostInput).toHaveValue('2.000,50');
    fireEvent.change(purchaseCostInput, { target: { value: '2000,50' } }); // User types two decimals
    expect(purchaseCostInput).toHaveValue('2.000,50');
    fireEvent.change(purchaseCostInput, { target: { value: '500.5' } }); // Simulate typing without comma, then backspace
    expect(purchaseCostInput).toHaveValue('500,50');
    fireEvent.change(purchaseCostInput, { target: { value: '500' } });
    expect(purchaseCostInput).toHaveValue('500,00');

    // Final value to send
    fireEvent.change(purchaseCostInput, { target: { value: '200.50' } }); // Forcing a correct value
    
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Compra' }));

    await waitFor(() => {
      expect(dbService.registerMaterialPurchase).toHaveBeenCalledWith(
        'mat-1',
        'Cimento',
        'Marca Cimento',
        100,
        'saco',
        10,
        200.50
      );
      expect(dbService.getMaterials).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Registrar Compra')).not.toBeInTheDocument();
    });
  });

  // --- Testes de CRUD para Despesas ---
  it('should add a new expense with currency formatting', async () => {
    (dbService.addExpense as jest.Mock).mockResolvedValue({ ...mockExpenses[0], id: 'new-exp-id', description: 'Novo Gasto' });
    (dbService.getExpenses as jest.Mock).mockResolvedValue([...mockExpenses, { ...mockExpenses[0], id: 'new-exp-id', description: 'Novo Gasto' }]);

    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=FINANCEIRO' });

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Financeiro')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nova despesa/i }));
    await waitFor(() => expect(screen.getByText('Adicionar Nova Despesa')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Novo Gasto' } });
    fireEvent.change(screen.getByLabelText('Valor Total (R$)'), { target: { value: '150.75' } }); // Test formatted input
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-03-01' } });

    expect(screen.getByLabelText('Valor Total (R$)')).toHaveValue('150,75'); // Should be formatted in UI

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Despesa' }));

    await waitFor(() => {
      expect(dbService.addExpense).toHaveBeenCalledWith(expect.objectContaining({ description: 'Novo Gasto', amount: 150.75 }));
      expect(dbService.getExpenses).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Adicionar Nova Despesa')).not.toBeInTheDocument();
    });
  });

  it('should add payment to an existing expense with currency formatting', async () => {
    (dbService.addPaymentToExpense as jest.Mock).mockResolvedValue({ ...mockExpenses[1], paidAmount: 2000 });
    (dbService.getExpenses as jest.Mock).mockResolvedValue([{ ...mockExpenses[1], paidAmount: 2000 }, ...mockExpenses.slice(0,1), ...mockExpenses.slice(2)]); // Update mock expenses

    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=FINANCEIRO' });

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Financeiro')).toBeInTheDocument());

    // Assuming initial expenses rendering shows 'Pagamento pedreiro'
    // To see the "Pagar" button, we need to ensure the expense is not fully paid
    const unpaidExpense = screen.getByText('Pagamento pedreiro');
    expect(unpaidExpense).toBeInTheDocument();

    const payButton = screen.getByRole('button', { name: /pagar r\$ 1\.000,00/i }); // Button for exp-2
    fireEvent.click(payButton);

    await waitFor(() => expect(screen.getByText('Adicionar Pagamento para "Pagamento pedreiro"')).toBeInTheDocument());

    const paymentAmountInput = screen.getByLabelText('Valor do Pagamento (R$)');
    fireEvent.change(paymentAmountInput, { target: { value: '1000' } });
    expect(paymentAmountInput).toHaveValue('1.000,00');

    fireEvent.change(screen.getByLabelText('Data do Pagamento'), { target: { value: '2024-03-15' } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Pagamento' }));

    await waitFor(() => {
      expect(dbService.addPaymentToExpense).toHaveBeenCalledWith('exp-2', 1000, '2024-03-15');
      expect(dbService.getExpenses).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Adicionar Pagamento para "Pagamento pedreiro"')).not.toBeInTheDocument();
    });
  });


  // --- Testes para acesso a funcionalidades Premium ---
  it('should restrict access to premium reports for non-vitalicio users', async () => {
    // Mock user with a basic plan
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockUser, plan: PlanType.MENSAL, isTrial: false, subscriptionExpiresAt: '2025-01-01' },
      authLoading: false,
      isUserAuthFinished: true,
      refreshUser: jest.fn(),
      isSubscriptionValid: true,
      trialDaysRemaining: null,
    });
    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=FERRAMENTAS' });
    (ReactRouter.useMatch as jest.Mock).mockReturnValue({ params: { id: mockWork.id } }); // Match work detail page

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Ferramentas de Gestão')).toBeInTheDocument());

    const reportsCard = screen.getByRole('button', { name: /relatórios completos/i });
    expect(reportsCard).toBeInTheDocument();
    expect(reportsCard).toBeDisabled(); // Should be locked for non-premium

    fireEvent.click(reportsCard); // Try to click it
    await waitFor(() => expect(screen.getByText('Acesso Premium necessário!')).toBeInTheDocument()); // Modal should open

    fireEvent.click(screen.getByRole('button', { name: 'Ver Planos' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('should allow access to premium reports for vitalicio users', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockUser, plan: PlanType.VITALICIO, isTrial: false },
      authLoading: false,
      isUserAuthFinished: true,
      refreshUser: jest.fn(),
      isSubscriptionValid: true, // Vitalicio is always valid
      trialDaysRemaining: null,
    });
    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useLocation as jest.Mock).mockReturnValue({ pathname: `/work/${mockWork.id}`, search: '?tab=FERRAMENTAS' });
    (ReactRouter.useMatch as jest.Mock).mockReturnValue({ params: { id: mockWork.id } });

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Ferramentas de Gestão')).toBeInTheDocument());

    const reportsCard = screen.getByRole('button', { name: /relatórios completos/i });
    expect(reportsCard).toBeInTheDocument();
    expect(reportsCard).not.toBeDisabled(); // Should NOT be locked

    fireEvent.click(reportsCard);
    expect(mockNavigate).toHaveBeenCalledWith(`/work/${mockWork.id}/reports`); // Should navigate to reports view
    expect(screen.queryByText('Acesso Premium necessário!')).not.toBeInTheDocument(); // No modal
  });

  // Testes para a barra de navegação inferior (BottomNavBar)
  it('should render the bottom navigation bar on WorkDetail page', async () => {
    (ReactRouter.useMatch as jest.Mock).mockReturnValue({ params: { id: mockWork.id } }); // Simulate matching work/:id

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Obra de Teste')).toBeInTheDocument());

    const bottomNav = screen.getByRole('navigation', { name: 'Barra de navegação inferior' });
    expect(bottomNav).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /cronograma/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /materiais/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /financeiro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ferramentas/i })).toBeInTheDocument();
  });

  it('should update active tab and navigate when clicking bottom nav buttons', async () => {
    const mockNavigate = jest.fn();
    (ReactRouter.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (ReactRouter.useMatch as jest.Mock).mockReturnValue({ params: { id: mockWork.id } }); // Simulate matching work/:id

    render(<WorkDetail />);
    await waitFor(() => expect(screen.getByText('Obra de Teste')).toBeInTheDocument());

    const materiaisButton = screen.getByRole('button', { name: /materiais/i });
    fireEvent.click(materiaisButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/work/${mockWork.id}?tab=MATERIAIS`);
    });
  });
});