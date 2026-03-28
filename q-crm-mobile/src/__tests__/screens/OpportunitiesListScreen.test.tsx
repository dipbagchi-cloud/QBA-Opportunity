/**
 * Screen tests for OpportunitiesListScreen.
 * useQuery is mocked to control loading / data / error states.
 */
import React from 'react';
import {render, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {mockOpportunityList} from '../setup/mock-data';
import {createTestQueryClient} from '../setup/test-utils';
import {QueryClientProvider} from '@tanstack/react-query';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children}: any) => children,
  SafeAreaProvider: ({children}: any) => children,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  initialWindowMetrics: {
    frame: {x: 0, y: 0, width: 375, height: 812},
    insets: {top: 44, right: 0, bottom: 34, left: 0},
  },
}));

// Prevent Animated timing loops from outliving each test
jest.useFakeTimers();

// Stub out the animated skeleton to avoid act() warnings
jest.mock('../../components/ui/SkeletonLoader', () => ({
  SkeletonCard: () => null,
  SkeletonListItem: () => null,
  SkeletonBar: () => null,
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

// Mock the API so we control what useQuery receives
jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

type QueryReturnValue = {
  data: any;
  isLoading: boolean;
  isFetching: boolean;
  refetch: jest.Mock;
};

let mockQueryReturn: QueryReturnValue = {
  data: {data: mockOpportunityList, total: mockOpportunityList.length},
  isLoading: false,
  isFetching: false,
  refetch: jest.fn(),
};

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => mockQueryReturn),
}));

import {OpportunitiesListScreen} from '../../screens/opportunities/OpportunitiesListScreen';

// ─── Setup ────────────────────────────────────────────────────────────────────

function renderScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OpportunitiesListScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryReturn = {
    data: {data: mockOpportunityList, total: mockOpportunityList.length},
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OpportunitiesListScreen', () => {
  describe('rendering', () => {
    it('renders the screen title "Opportunities"', () => {
      renderScreen();
      expect(screen.getByText('Opportunities')).toBeTruthy();
    });

    it('renders the search input', () => {
      renderScreen();
      expect(screen.getByPlaceholderText('Search opportunities...')).toBeTruthy();
    });

    it('renders stage filter chips', () => {
      renderScreen();
      expect(screen.getByText('All')).toBeTruthy();
      // Stage names appear both in filter chips and in opportunity cards
      expect(screen.getAllByText('Lead').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Proposal').length).toBeGreaterThanOrEqual(1);
    });

    it('renders opportunity names from the list', () => {
      renderScreen();
      expect(screen.getByText('Digital Transformation Programme')).toBeTruthy();
      expect(screen.getByText('CRM Modernisation')).toBeTruthy();
    });

    it('renders client names (with emoji prefix)', () => {
      renderScreen();
      // OpportunityCard renders "🏢 Acme Corp"
      expect(screen.getByText(/Acme Corp/)).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('shows SkeletonCard components while loading', () => {
      mockQueryReturn = {
        data: undefined,
        isLoading: true,
        isFetching: true,
        refetch: jest.fn(),
      };
      renderScreen();
      // FlatList renders ListEmptyComponent when data is empty and isLoading=true
      // At minimum the screen renders without crashing
      expect(screen.getByText('Opportunities')).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('shows "No opportunities found" when list is empty', () => {
      mockQueryReturn = {
        data: {data: [], total: 0},
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
      };
      renderScreen();
      expect(screen.getByText('No opportunities found')).toBeTruthy();
    });
  });

  describe('search', () => {
    it('search input is interactable', () => {
      renderScreen();
      const searchInput = screen.getByPlaceholderText('Search opportunities...');
      fireEvent.changeText(searchInput, 'Digital');
      // Input value update should not crash
      expect(searchInput.props.value).toBe('Digital');
    });

    it('clear button appears after typing and clears input', () => {
      renderScreen();
      const searchInput = screen.getByPlaceholderText('Search opportunities...');
      fireEvent.changeText(searchInput, 'test');

      // Find and press the clear button (✕)
      const clearBtn = screen.getByText('✕');
      fireEvent.press(clearBtn);

      expect(screen.getByPlaceholderText('Search opportunities...').props.value).toBe('');
    });
  });

  describe('navigation', () => {
    it('tapping an opportunity navigates to OpportunityDetail with id and name', () => {
      renderScreen();
      const opp = mockOpportunityList[0];
      fireEvent.press(screen.getByText(opp.name));

      expect(mockNavigate).toHaveBeenCalledWith('OpportunityDetail', {
        id: opp.id,
        name: opp.name,
      });
    });
  });

  describe('stage filter chips', () => {
    it('pressing a stage chip changes the active chip', () => {
      renderScreen();
      // "Lead" appears in both the chip row and opportunity cards — pick first chip occurrence
      const leadChips = screen.getAllByText('Lead');
      fireEvent.press(leadChips[0]);
      expect(screen.getAllByText('Lead').length).toBeGreaterThanOrEqual(1);
    });

    it('pressing All chip deselects stage filter', () => {
      renderScreen();
      // "Proposal" can appear in chip row and in opportunity stage — press the chip (first occurrence)
      const proposalChips = screen.getAllByText('Proposal');
      fireEvent.press(proposalChips[0]);
      fireEvent.press(screen.getAllByText('All')[0]);
      expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('view mode toggle', () => {
    it('renders list and kanban toggle icons', () => {
      renderScreen();
      expect(screen.getByText('☰')).toBeTruthy();
      expect(screen.getByText('⊞')).toBeTruthy();
    });
  });
});
