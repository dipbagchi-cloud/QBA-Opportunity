import { create } from 'zustand';

export interface Opportunity {
    id: string;
    name: string;
    client: string;
    value: number;
    stage: string;
    probability: number;
    lastActivity: string;
    owner: string;
    status: 'healthy' | 'at-risk' | 'critical';
    description?: string;
    // Epic 3 Intelligence Fields
    healthScore?: number;
    isStalled?: boolean;
    daysInStage?: number;
}

interface OpportunityStore {
    opportunities: Opportunity[];
    isLoading: boolean;
    fetchOpportunities: () => Promise<void>;
    addOpportunity: (opportunity: any) => Promise<void>;
    deleteOpportunity: (id: string) => Promise<void>;
    updateOpportunity: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

export const useOpportunityStore = create<OpportunityStore>((set, get) => ({
    opportunities: [],
    isLoading: false,

    fetchOpportunities: async () => {
        set({ isLoading: true });
        try {
            const res = await fetch('/api/opportunities');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            set({ opportunities: data, isLoading: false });
        } catch (error) {
            console.error("Failed to fetch", error);
            set({ isLoading: false });
        }
    },

    addOpportunity: async (opportunity) => {
        try {
            const res = await fetch('/api/opportunities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        // await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
    },

    updateOpportunity: async (id, updates) => {
        // Optimistic update
        set((state) => ({
            opportunities: state.opportunities.map((opp) =>
                opp.id === id ? { ...opp, ...updates } : opp
            ),
        }));

        try {
            // Persist to backend (Epic 3 Persistence)
            // Note: We need a PATCH endpoint for this to work fully.
            // For now, we simulate success or log error.
            /* 
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            }); 
            */
        } catch (error) {
            console.error("Failed to update", error);
            // Revert optimistically
            get().fetchOpportunities();
        }
    },
}));
