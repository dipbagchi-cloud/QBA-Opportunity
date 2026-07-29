import { create } from 'zustand';
import { API_URL, getAuthHeaders } from './api';

export interface Opportunity {
    id: string;
    name: string;
    client: string;
    ownerId?: string;
    value: number;
    stage: string;
    probability: number;
    lastActivity: string;
    owner: string;
    salesRepName?: string;
    managerName?: string;
    technology?: string;
    practice?: string;
    region?: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    tentativeStartDate?: string;
    tentativeEndDate?: string;
    createdAt?: string;
    status: 'healthy' | 'at-risk' | 'critical' | 'stalled';
    detailedStatus?: string;
    description?: string;
    // Epic 3 Intelligence Fields
    healthScore?: number;
    isStalled?: boolean;
    daysInStage?: number;
    daysSinceActivity?: number;
    gomApproved?: boolean;
    access?: {
        canEdit: boolean;
        viewOnlyReason?: string | null;
    };
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
    stages?: string[];
    client?: string;
    owner?: string;
    salesRep?: string;
    manager?: string;
    name?: string;
    practice?: string;
    technology?: string;
    sortKey?: string;
    sortDir?: 'asc' | 'desc';
}

interface OpportunityStore {
    opportunities: Opportunity[];
    isLoading: boolean;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    fetchOpportunities: (params?: PaginationParams) => Promise<void>;
    addOpportunity: (opportunity: any) => Promise<any>;
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
            if (params?.stages?.length) qp.set('stages', params.stages.join(','));
            if (params?.client) qp.set('client', params.client);
            if (params?.owner) qp.set('owner', params.owner);
            if (params?.salesRep) qp.set('salesRep', params.salesRep);
            if (params?.manager) qp.set('manager', params.manager);
            if (params?.name) qp.set('name', params.name);
            if (params?.practice) qp.set('practice', params.practice);
            if (params?.technology) qp.set('technology', params.technology);
            if (params?.sortKey) qp.set('sortKey', params.sortKey);
            if (params?.sortDir) qp.set('sortDir', params.sortDir);
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
        // NOTE: this intentionally throws on failure. A non-2xx response (e.g. a
        // 400 validation error or a 401 from an expired token) is NOT a network
        // exception, so `fetch` resolves normally — swallowing it here would let
        // the caller navigate away as if the save succeeded, silently dropping
        // the opportunity. Surface the server's message so the UI can show it.
        const res = await fetch(`${API_URL}/api/opportunities`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(opportunity)
        });
        if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            throw new Error(detail?.error || `Failed to create opportunity (HTTP ${res.status}).`);
        }
        const created = await res.json();
        await get().fetchOpportunities(); // Refresh list
        return created;
    },

    deleteOpportunity: async (id) => {
        // Hard delete on the server (Admin only — enforced by the backend).
        // Throws on failure so the caller can surface the reason; only remove
        // from local state AFTER the server confirms, then refresh totals.
        const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            throw new Error(detail?.error || `Failed to delete opportunity (HTTP ${res.status}).`);
        }
        set((state) => ({
            opportunities: state.opportunities.filter((opp) => opp.id !== id),
        }));
        await get().fetchOpportunities();
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
