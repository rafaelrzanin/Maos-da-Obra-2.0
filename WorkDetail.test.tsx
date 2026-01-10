/// <reference types="jest" />
/// <reference types="node" />
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WorkDetail from './pages/WorkDetail.tsx'; // Ensure this path is correct based on your file structure

// Mock the AuthContext
jest.mock('./contexts/AuthContext.tsx', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', plan: 'VITALICIO', isTrial: false, subscriptionExpiresAt: '2099-01-01' },
    authLoading: false,
    isUserAuthFinished: true,
    isSubscriptionValid: true,
    trialDaysRemaining: 0,
    refreshUser: jest.fn(),
    unreadNotificationsCount: 0,
    refreshNotifications: jest.fn(),
    requestPushNotificationPermission: jest.fn(),
    pushSubscriptionStatus: 'idle',
  }),
}));

// Mock dbService
jest.mock('./services/db.ts', () => ({
  dbService: {
    getWorkById: jest.fn().mockResolvedValue({
      id: 'test-work-id',
      userId: 'test-user-id',
      name: 'Test Work',
      address: 'Test Address',
      budgetPlanned: 100000,
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      area: 100,
      status: 'PLANNING',
      notes: 'Test Notes',
    }),
    getSteps: jest.fn().mockResolvedValue([]),
    getMaterials: jest.fn().mockResolvedValue([]),
    getExpenses: jest.fn().mockResolvedValue([]),
    getWorkers: jest.fn().mockResolvedValue([]),
    getSuppliers: jest.fn().mockResolvedValue([]),
    getPhotos: jest.fn().mockResolvedValue([]),
    getFiles: jest.fn().mockResolvedValue([]),
    getContractTemplates: jest.fn().mockResolvedValue([]),
    getChecklists: jest.fn().mockResolvedValue([]),
    ensureMaterialsForWork: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock supabase for storage operations if needed, but not directly used in initial render
jest.mock('./services/supabase.ts', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://test.url/test-path' } }),
      })),
    },
  },
}));

describe('WorkDetail', () => {
  beforeEach(() => {
    // Reset mocks before each test
    // No need for `as any` here as `require` types will be available if `@types/node` is installed.
    require('./services/db.ts').dbService.getWorkById.mockClear();
    require('./services/db.ts').dbService.getSteps.mockClear();
    require('./services/db.ts').dbService.getMaterials.mockClear();
    require('./services/db.ts').dbService.getExpenses.mockClear();
    require('./services/db.ts').dbService.getWorkers.mockClear();
    require('./services/db.ts').dbService.getSuppliers.mockClear();
    require('./services/db.ts').dbService.getPhotos.mockClear();
    require('./services/db.ts').dbService.getFiles.mockClear();
    require('./services/db.ts').dbService.getContractTemplates.mockClear();
    require('./services/db.ts').dbService.getChecklists.mockClear();
    require('./services/db.ts').dbService.ensureMaterialsForWork.mockClear();
  });

  it('renders loading state initially', () => {
    // Mock authLoading to true to simulate initial loading
    require('./contexts/AuthContext.tsx').useAuth.mockReturnValueOnce({
      user: null,
      authLoading: true,
      isUserAuthFinished: false,
      isSubscriptionValid: false,
      trialDaysRemaining: null,
      refreshUser: jest.fn(),
      unreadNotificationsCount: 0,
      refreshNotifications: jest.fn(),
      requestPushNotificationPermission: jest.fn(),
      pushSubscriptionStatus: 'idle',
    });

    render(
      <BrowserRouter>
        <WorkDetail activeTab="ETAPAS" onTabChange={jest.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText('Carregando detalhes da obra...')).toBeInTheDocument();
  });

  it('renders work details after loading', async () => {
    render(
      <BrowserRouter>
        <WorkDetail activeTab="ETAPAS" onTabChange={jest.fn()} />
      </BrowserRouter>
    );

    // Wait for the asynchronous data loading to complete
    expect(await screen.findByText('Test Work')).toBeInTheDocument();
    expect(screen.getByText('Test Address • 100m² • Início: 01/01')).toBeInTheDocument();
    expect(screen.getByText('Cronograma')).toBeInTheDocument(); // Tab title
  });

  it('calls loadWorkData on mount when authenticated', async () => {
    render(
      <BrowserRouter>
        <WorkDetail activeTab="ETAPAS" onTabChange={jest.fn()} />
      </BrowserRouter>
    );

    // Wait for the loading text to disappear, indicating data has been fetched
    expect(await screen.findByText('Test Work')).toBeInTheDocument();
    // No need for `as any` here as `require` types will be available if `@types/node` is installed.
    expect(require('./services/db.ts').dbService.getWorkById).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getSteps).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getMaterials).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getExpenses).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getWorkers).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getSuppliers).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getPhotos).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getFiles).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.getContractTemplates).toHaveBeenCalled();
    expect(require('./services/db.ts').dbService.getChecklists).toHaveBeenCalledWith('test-work-id');
    expect(require('./services/db.ts').dbService.ensureMaterialsForWork).toHaveBeenCalled();
  });

  // Add more tests for different tabs, sub-views, modal interactions, etc.
});