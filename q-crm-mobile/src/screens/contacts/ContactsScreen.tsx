import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const AVATAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

export default function ContactsScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);

  // Form
  const emptyForm = { firstName: '', lastName: '', email: '', phone: '', title: '', department: '', clientId: '', clientName: '', linkedInUrl: '', isPrimary: false };
  const [form, setForm] = useState(emptyForm);
  const [newClientName, setNewClientName] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');
  if (search.trim()) queryParams.set('search', search.trim());
  if (clientFilter) queryParams.set('clientId', clientFilter);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contacts', queryParams.toString()],
    queryFn: () => api.get(`/api/contacts?${queryParams.toString()}`),
  });

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/api/master/clients') });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/api/contacts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); closeModal(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/api/contacts/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); closeModal(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/contacts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); },
  });
  const createClientMut = useMutation({
    mutationFn: (body: { name: string }) => api.post('/api/master/clients', body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setForm(f => ({ ...f, clientId: data.id, clientName: data.name }));
      setNewClientName('');
      setShowNewClient(false);
      Alert.alert('Success', `Client "${data.name}" created`);
    },
    onError: (e: any) => Alert.alert('Error', e.message || 'Failed to create client'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await refetch(); setRefreshing(false);
  }, [refetch]);

  const openCreate = () => { setEditingContact(null); setForm(emptyForm); setModalVisible(true); };
  const openEdit = (c: any) => {
    setEditingContact(c);
    setForm({
      firstName: c.firstName || '', lastName: c.lastName || '', email: c.email || '',
      phone: c.phone || '', title: c.title || '', department: c.department || '',
      clientId: c.clientId || '', clientName: c.client?.name || '', linkedInUrl: c.linkedInUrl || '',
      isPrimary: c.isPrimary || false,
    });
    setModalVisible(true);
  };
  const closeModal = () => { setModalVisible(false); setEditingContact(null); setForm(emptyForm); };

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert('Required', 'First name and last name are required'); return;
    }
    const body = {
      firstName: form.firstName, lastName: form.lastName,
      email: form.email || undefined, phone: form.phone || undefined,
      title: form.title || undefined, department: form.department || undefined,
      clientId: form.clientId || undefined, linkedInUrl: form.linkedInUrl || undefined,
      isPrimary: form.isPrimary,
    };
    if (editingContact) {
      updateMut.mutate({ id: editingContact.id, body });
    } else {
      createMut.mutate(body);
    }
  };

  const handleDelete = (c: any) => {
    Alert.alert('Delete Contact', `Delete ${c.firstName} ${c.lastName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(c.id) },
    ]);
  };

  const contacts = data?.contacts || data?.data || data || [];
  const total = data?.total || contacts.length;
  const totalPages = data?.totalPages || 1;

  const getAvatar = (c: any) => {
    const initials = `${(c.firstName || '')[0] || ''}${(c.lastName || '')[0] || ''}`.toUpperCase();
    const color = AVATAR_COLORS[initials.charCodeAt(0) % AVATAR_COLORS.length];
    return { initials, color };
  };

  const renderContact = ({ item }: { item: any }) => {
    const { initials, color } = getAvatar(item);
    return (
      <TouchableOpacity style={st.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
        <View style={[st.avatar, { backgroundColor: color + '20' }]}>
          <Text style={[st.avatarText, { color }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.contactName}>{item.firstName} {item.lastName}</Text>
          {item.title && <Text style={st.contactTitle}>{item.title}</Text>}
          {item.client?.name && <Text style={st.contactClient}>{item.client.name}</Text>}
          <View style={st.contactMeta}>
            {item.email && <Text style={st.metaText}>✉ {item.email}</Text>}
            {item.phone && <Text style={st.metaText}>📞 {item.phone}</Text>}
            {item.linkedInUrl && <Text style={st.metaText}>in LinkedIn</Text>}
          </View>
        </View>
        {item.isPrimary && (
          <View style={st.primaryBadge}><Text style={st.primaryText}>Primary</Text></View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.container}>
      {/* Header */}
      <View style={st.headerRow}>
        <Text style={st.title}>Contacts</Text>
        <TouchableOpacity style={st.addBtn} onPress={openCreate}>
          <Text style={st.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <TextInput style={st.searchInput} placeholder="Search contacts..." value={search}
          onChangeText={t => { setSearch(t); setPage(1); }} placeholderTextColor="#94a3b8" />
      </View>

      {/* Client filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        <TouchableOpacity style={[st.chip, !clientFilter && st.chipActive]} onPress={() => { setClientFilter(''); setPage(1); }}>
          <Text style={[st.chipText, !clientFilter && st.chipTextActive]}>All Clients</Text>
        </TouchableOpacity>
        {(clients || []).slice(0, 15).map((c: any) => (
          <TouchableOpacity key={c.id} style={[st.chip, clientFilter === c.id && st.chipActive]}
            onPress={() => { setClientFilter(c.id); setPage(1); }}>
            <Text style={[st.chipText, clientFilter === c.id && st.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={st.countText}>{total} contacts</Text>

      {isLoading && !refreshing ? (
        <View style={st.loadWrap}><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : (
        <>
          <FlatList data={contacts} renderItem={renderContact} keyExtractor={c => c.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text style={st.emptyText}>No contacts found</Text>} />
          {totalPages > 1 && (
            <View style={st.pagination}>
              <TouchableOpacity style={[st.pageBtn, page <= 1 && st.pageBtnDisabled]} disabled={page <= 1} onPress={() => setPage(p => p - 1)}>
                <Text style={st.pageBtnText}>← Prev</Text>
              </TouchableOpacity>
              <Text style={st.pageInfo}>Page {page} of {totalPages}</Text>
              <TouchableOpacity style={[st.pageBtn, page >= totalPages && st.pageBtnDisabled]} disabled={page >= totalPages} onPress={() => setPage(p => p + 1)}>
                <Text style={st.pageBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <ScrollView style={st.modalScroll} contentContainerStyle={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{editingContact ? 'Edit Contact' : 'New Contact'}</Text>
              <TouchableOpacity onPress={closeModal}><Text style={st.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <Text style={st.label}>First Name *</Text>
            <TextInput style={st.input} value={form.firstName} onChangeText={t => setForm(f => ({ ...f, firstName: t }))} placeholder="First name" placeholderTextColor="#94a3b8" />

            <Text style={st.label}>Last Name *</Text>
            <TextInput style={st.input} value={form.lastName} onChangeText={t => setForm(f => ({ ...f, lastName: t }))} placeholder="Last name" placeholderTextColor="#94a3b8" />

            <Text style={st.label}>Client</Text>
            <TouchableOpacity style={st.pickerTrigger} onPress={() => setClientPickerVisible(true)}>
              <Text style={form.clientName ? st.pickerText : st.pickerPlaceholder}>{form.clientName || 'Select client'}</Text>
              <Text style={st.pickerArrow}>▼</Text>
            </TouchableOpacity>

            <Text style={st.label}>Title</Text>
            <TextInput style={st.input} value={form.title} onChangeText={t => setForm(f => ({ ...f, title: t }))} placeholder="Job title" placeholderTextColor="#94a3b8" />

            <Text style={st.label}>Department</Text>
            <TextInput style={st.input} value={form.department} onChangeText={t => setForm(f => ({ ...f, department: t }))} placeholder="Department" placeholderTextColor="#94a3b8" />

            <Text style={st.label}>Email</Text>
            <TextInput style={st.input} value={form.email} onChangeText={t => setForm(f => ({ ...f, email: t }))} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#94a3b8" />

            <Text style={st.label}>Phone</Text>
            <TextInput style={st.input} value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} placeholder="+1234567890" keyboardType="phone-pad" placeholderTextColor="#94a3b8" />

            <Text style={st.label}>LinkedIn URL</Text>
            <TextInput style={st.input} value={form.linkedInUrl} onChangeText={t => setForm(f => ({ ...f, linkedInUrl: t }))} placeholder="https://linkedin.com/in/..." autoCapitalize="none" placeholderTextColor="#94a3b8" />

            <TouchableOpacity style={st.toggleRow} onPress={() => setForm(f => ({ ...f, isPrimary: !f.isPrimary }))}>
              <View style={[st.toggle, form.isPrimary && st.toggleActive]}>
                {form.isPrimary && <View style={st.toggleDot} />}
              </View>
              <Text style={st.toggleLabel}>Primary Contact</Text>
            </TouchableOpacity>

            <View style={st.modalActions}>
              <TouchableOpacity style={st.cancelBtn} onPress={closeModal}>
                <Text style={st.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? <ActivityIndicator color="#fff" /> :
                  <Text style={st.saveBtnText}>{editingContact ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Client picker modal */}
      <Modal visible={clientPickerVisible} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.pickerModalContent}>
            <Text style={st.modalTitle}>Select Client</Text>
            {showNewClient ? (
              <View style={{ padding: 12 }}>
                <Text style={st.label}>Client Name *</Text>
                <TextInput style={st.input} value={newClientName} onChangeText={setNewClientName} placeholder="Enter client name" placeholderTextColor="#94a3b8" />
                <View style={st.modalActions}>
                  <TouchableOpacity style={st.cancelBtn} onPress={() => { setShowNewClient(false); setNewClientName(''); }}>
                    <Text style={st.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.saveBtn} onPress={() => { if (!newClientName.trim()) { Alert.alert('Required', 'Client name is required'); return; } createClientMut.mutate({ name: newClientName.trim() }); }} disabled={createClientMut.isPending}>
                    {createClientMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
            <>
            <TouchableOpacity style={[st.pickerItem, { backgroundColor: '#f0fdf4', borderBottomWidth: 2, borderBottomColor: '#10b981' }]} onPress={() => setShowNewClient(true)}>
              <Text style={[st.pickerItemText, { color: '#10b981', fontWeight: '700' }]}>+ New Client</Text>
            </TouchableOpacity>
            <FlatList data={clients || []} keyExtractor={(c: any) => c.id}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity style={[st.pickerItem, form.clientId === item.id && st.pickerItemSel]}
                  onPress={() => { setForm(f => ({ ...f, clientId: item.id, clientName: item.name })); setClientPickerVisible(false); }}>
                  <Text style={st.pickerItemText}>{item.name}</Text>
                  {form.clientId === item.id && <Text style={st.checkMark}>✓</Text>}
                </TouchableOpacity>
              )}
              ListHeaderComponent={
                <TouchableOpacity style={st.pickerItem} onPress={() => { setForm(f => ({ ...f, clientId: '', clientName: '' })); setClientPickerVisible(false); }}>
                  <Text style={[st.pickerItemText, { color: '#94a3b8' }]}>None</Text>
                </TouchableOpacity>
              }
            />
            <TouchableOpacity style={st.cancelBtn} onPress={() => setClientPickerVisible(false)}>
              <Text style={st.cancelBtnText}>Close</Text>
            </TouchableOpacity>
            </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  searchWrap: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  filterScroll: { maxHeight: 40, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  countText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#64748b' },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  contactName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  contactTitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
  contactClient: { fontSize: 12, color: '#6366f1', marginTop: 1 },
  contactMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 8 },
  metaText: { fontSize: 11, color: '#94a3b8' },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#dbeafe' },
  primaryText: { fontSize: 10, fontWeight: '600', color: '#3b82f6' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#6366f1' },
  pageBtnDisabled: { backgroundColor: '#e2e8f0' },
  pageBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#64748b' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '85%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalClose: { fontSize: 20, color: '#94a3b8', padding: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerTrigger: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between' },
  pickerText: { fontSize: 14, color: '#0f172a' },
  pickerPlaceholder: { fontSize: 14, color: '#94a3b8' },
  pickerArrow: { fontSize: 10, color: '#94a3b8' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: '#6366f1', alignItems: 'flex-end' },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleLabel: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontWeight: '600', color: '#64748b' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center' },
  saveBtnText: { fontWeight: '600', color: '#fff' },
  pickerModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between' },
  pickerItemSel: { backgroundColor: '#f0f0ff' },
  pickerItemText: { fontSize: 15, color: '#0f172a' },
  checkMark: { fontSize: 16, color: '#6366f1', fontWeight: '700' },
});
