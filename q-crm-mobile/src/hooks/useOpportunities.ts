import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from '../lib/api';
import type {
  Opportunity,
  OpportunityListItem,
  PaginatedResponse,
  CreateOpportunityInput,
} from '../types';

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  stage?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export function useOpportunities(params: ListParams = {}) {
  const {page = 1, limit = 20, search, stage, sortBy, sortOrder} = params;

  const queryKey = ['opportunities', 'list', page, limit, search, stage, sortBy, sortOrder];

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));
  if (search) queryParams.set('search', search);
  if (stage) queryParams.set('stage', stage);
  if (sortBy) queryParams.set('sortBy', sortBy);
  if (sortOrder) queryParams.set('sortOrder', sortOrder);

  const query = useQuery<PaginatedResponse<OpportunityListItem>>({
    queryKey,
    queryFn: () => api.get(`/api/opportunities?${queryParams.toString()}`),
    staleTime: STALE_TIME,
    placeholderData: prev => prev,
  });

  return query;
}

export function useOpportunity(id: string) {
  return useQuery<Opportunity>({
    queryKey: ['opportunities', 'detail', id],
    queryFn: () => api.get(`/api/opportunities/${id}`),
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOpportunityInput) =>
      api.post<Opportunity>('/api/opportunities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['opportunities', 'list']});
      queryClient.invalidateQueries({queryKey: ['analytics']});
    },
  });
}

export function useUpdateOpportunity(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<CreateOpportunityInput>) =>
      api.put<Opportunity>(`/api/opportunities/${id}`, data),
    onSuccess: updatedOpp => {
      queryClient.setQueryData(['opportunities', 'detail', id], updatedOpp);
      queryClient.invalidateQueries({queryKey: ['opportunities', 'list']});
    },
  });
}

export function useApproveGom(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post(`/api/opportunities/${id}/approve-gom`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['opportunities', 'detail', id]});
      queryClient.invalidateQueries({queryKey: ['opportunities', 'list']});
    },
  });
}

export function useAddComment(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/opportunities/${opportunityId}/comments`, {content}),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['opportunities', 'detail', opportunityId]});
    },
  });
}
