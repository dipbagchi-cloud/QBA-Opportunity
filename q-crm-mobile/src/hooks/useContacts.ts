import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from '../lib/api';
import type {Contact, CreateContactInput, PaginatedResponse} from '../types';

const STALE_TIME = 3 * 60 * 1000; // 3 minutes

type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export function useContacts(params: ListParams = {}) {
  const {page = 1, limit = 30, search} = params;

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));
  if (search) queryParams.set('search', search);

  return useQuery<PaginatedResponse<Contact>>({
    queryKey: ['contacts', 'list', page, limit, search],
    queryFn: () => api.get(`/api/contacts?${queryParams.toString()}`),
    staleTime: STALE_TIME,
    placeholderData: prev => prev,
  });
}

export function useContact(id: string) {
  return useQuery<Contact>({
    queryKey: ['contacts', 'detail', id],
    queryFn: () => api.get(`/api/contacts/${id}`),
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContactInput) =>
      api.post<Contact>('/api/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['contacts', 'list']});
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<CreateContactInput>) =>
      api.put<Contact>(`/api/contacts/${id}`, data),
    onSuccess: updatedContact => {
      queryClient.setQueryData(['contacts', 'detail', id], updatedContact);
      queryClient.invalidateQueries({queryKey: ['contacts', 'list']});
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['contacts', 'list']});
    },
  });
}
