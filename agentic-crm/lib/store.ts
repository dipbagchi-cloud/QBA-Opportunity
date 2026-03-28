import { create } from 'zustand';
import { API_URL, getAuthHeaders } from './api';

export interface Opportunity {
    id: string;
    name: string;
    client: string;
    value: number;
    stage: string;
    probability: number;
    lastActivity: string;
    owner: string;
    salesRepName?: string;
    managerName?: string;
    technology?: string;
    region?: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    tentativeStartDate?: string;
    tentativeEndDate?: string;
    createdAt?: string;
    status: 'healthy' | 'at-risk' | 'critical';
    description?: string;
    // Epic 3 Intelligence Fields
    healthScore?: number;
    isStalled?: boolean;
    daysInStage?: number;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
}

interface OpportunityStore {
    opportunities: Opportunity[];
    isLoading: boolean;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    fetchOpportunities: (params?: PaginationParams) => Promise<void>;
    addOpportunity: (opportunity: any) => Promise<void>;
    deleteOpportunity: (id: string) => Promise<void>;
    updateOpportunity: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

export const useOpportunityStore = create<OpportunityStore>((set, get) => ({
    opportunities: [],
    isLoading: false,
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,

    fetchOpportunities: async (params?: PaginationParams) => {
        set({ isLoading: true });
        try {
            const qp = new URLSearchParams();
            if (params?.page) qp.set('page', String(params.page));
            if (params?.limit) qp.set('limit', String(params.limit));
            if (params?.search) qp.set('search', params.search);
            if (params?.stage) qp.set('stage', params.stage);
            const qs = qp.toString();
            const res = await fetch(`${API_URL}/api/opportunities${qs ? `?${qs}` : ''}`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            // Support both paginated response { data, total, ... } and legacy flat array
            if (json.data && Array.isArray(json.data)) {
                set({
                    opportunities: json.data,
                    total: json.total ?? json.data.length,
                    page: json.page ?? 1,
                    limit: json.limit ?? 10,
                    totalPages: json.totalPages ?? 1,
                    isLoading: false,
                });
            } else if (Array.isArray(json)) {
                set({ opportunities: json, total: json.length, page: 1, totalPages: 1, isLoading: false });
            } else {
                set({ opportunities: [], isLoading: false });
            }
        } catch (error) {
            console.error("Failed to fetch", error);
            set({ isLoading: false });
        }
    },

    addOpportunity: async (opportunity) => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(opportunity)
            });
            if (res.ok) {
                await get().fetchOpportunities(); // Refresh list
            }
        } catch (error) {
            console.error("Failed to add", error);
        }
    },

    deleteOpportunity: async (id) => {
        // Optimistic update
        set((state) => ({
            opportunities: state.opportunities.filter((opp) => opp.id !== id),
        }));

        // In a real implementation:
        // await fetch(`${API_URL}/api/opportunities/${id}`, { method: 'DELETE' });
    },

    updateOpportunity: async (id, updates) => {
        // Optimistic update
        set((state) => ({
            opportunities: state.opportunities.map((opp) =>
                opp.id === id ? { ...opp, ...updates } : opp
            ),
        }));

        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(updates)
            });
            if (!res.ok) {
                console.error("Failed to update on server");
                get().fetchOpportunities();
            }
        } catch (error) {
            console.error("Failed to update", error);
            // Revert optimistically
            get().fetchOpportunities();
        }
    },
}));
