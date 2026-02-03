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
    status: 'healthy' | 'at-risk';
    description?: string;
}

interface OpportunityStore {
    opportunities: Opportunity[];
    isLoading: boolean;
    fetchOpportunities: () => Promise<void>;
    addOpportunity: (opportunity: any) => Promise<void>;
    deleteOpportunity: (id: string) => Promise<void>;
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
}));
