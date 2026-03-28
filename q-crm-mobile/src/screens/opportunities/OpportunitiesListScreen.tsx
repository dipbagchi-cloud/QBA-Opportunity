import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, ScrollView, Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCurrency } from '../../contexts/CurrencyContext';

const { width } = Dimensions.get('window');

const STAGES = ['All', 'Pipeline', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost', 'Proposal Lost'];
const STAGE_COLORS: Record<string, string> = {
  Pipeline: '#6366f1', Discovery: '#6366f1', Qualification: '#f59e0b', Presales: '#f59e0b',
  Proposal: '#8b5cf6', Sales: '#8b5cf6', Negotiation: '#f97316',
  'Closed Won': '#10b981', 'Closed Lost': '#ef4444', 'Proposal Lost': '#e11d48', Project: '#10b981',
};

export default function OpportunitiesListScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { formatCompact: fmt } = useCurrency();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [refreshing, setRefreshing] = useState(false);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '20');
    if (search.trim()) p.set('search', search.trim());
    if (stageFilter !== 'All') p.set('stage', stageFilter);
    return p.toString();
  }, [page, search, stageFilter]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['opportunities', queryParams],
    queryFn: () => api.get(`/api/opportunities?${queryParams}`),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/opportunities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opportunities'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Opportunity', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(id) },
    ]);
  };

  const opps = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const renderOpp = ({ item }: { item: any }) => {
    const stageColor = STAGE_COLORS[item.stage] || '#94a3b8';
    const healthColor = item.status === 'healthy' ? '#10b981' : item.status === 'at-risk' ? '#f59e0b' : '#ef4444';
    return (
      <TouchableOpacity style={st.oppCard}
        onPress={() => nav.navigate('OpportunityDetail', { id: item.id })}
        onLongPress={() => handleDelete(item.id, item.name)}>
        <View style={st.oppHeader}>
          <View style={[st.healthDot, { backgroundColor: healthColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={st.oppName} numberOfLines={1}>{item.name}</Text>
            <Text style={st.oppClient}>{item.client} • {item.owner || 'Unassigned'}</Text>
          </View>
          <View style={[st.stageBadge, { backgroundColor: stageColor + '20' }]}>
            <Text style={[st.stageText, { color: stageColor }]}>{item.stage}</Text>
          </View>
        </View>
        <View style={st.oppMeta}>
          <View style={st.metaItem}>
            <Text style={st.metaLabel}>Value</Text>
            <Text style={st.metaValue}>{fmt(item.value || 0)}</Text>
          </View>
          <View style={st.metaItem}>
            <Text style={st.metaLabel}>Probability</Text>
            <View style={st.probWrap}>
              <View style={st.probTrack}>
                <View style={[st.probFill, { width: `${item.probability || 0}%`,
                  backgroundColor: (item.probability || 0) >= 80 ? '#10b981' : (item.probability || 0) >= 50 ? '#6366f1' : (item.probability || 0) >= 20 ? '#f59e0b' : '#94a3b8' }]} />
              </View>
              <Text style={st.probText}>{item.probability || 0}%</Text>
            </View>
          </View>
          <View style={st.metaItem}>
            <Text style={st.metaLabel}>Days</Text>
            <Text style={[st.metaValue, item.isStalled && { color: '#ef4444' }]}>{item.daysInStage ?? '-'}{item.isStalled ? ' ⚠️' : ''}</Text>
          </View>
        </View>
        <View style={st.oppFooter}>
          {item.salesRepName && <Text style={st.footerText}>Rep: {item.salesRepName}</Text>}
          {item.managerName && <Text style={st.footerText}>Mgr: {item.managerName}</Text>}
          {item.lastActivity && <Text style={st.footerText}>{item.lastActivity}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  // Kanban view
  const kanbanStages = ['Pipeline', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost', 'Proposal Lost'];
  const renderKanban = () => {
    const allOpps = opps;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        {kanbanStages.map(stage => {
          const items = allOpps.filter((o: any) => o.stage === stage);
          const color = STAGE_COLORS[stage] || '#94a3b8';
          return (
            <View key={stage} style={st.kanbanCol}>
              <View style={[st.kanbanHeader, { borderBottomColor: color }]}>
                <Text style={[st.kanbanTitle, { color }]}>{stage}</Text>
                <View style={[st.kanbanCount, { backgroundColor: color + '20' }]}>
                  <Text style={[st.kanbanCountText, { color }]}>{items.length}</Text>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {items.map((opp: any) => (
                  <TouchableOpacity key={opp.id} style={st.kanbanCard}
                    onPress={() => nav.navigate('OpportunityDetail', { id: opp.id })}>
                    <Text style={st.kanbanName} numberOfLines={2}>{opp.name}</Text>
                    <Text style={st.kanbanClient}>{opp.client}</Text>
                    <Text style={[st.kanbanValue, { color }]}>{fmt(opp.value || 0)}</Text>
                    <View style={st.kanbanHealthRow}>
                      <View style={[st.healthDot, { backgroundColor: opp.status === 'healthy' ? '#10b981' : opp.status === 'at-risk' ? '#f59e0b' : '#ef4444' }]} />
                      <Text style={st.kanbanDays}>{opp.daysInStage ?? 0}d</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {items.length === 0 && <Text style={st.kanbanEmpty}>No items</Text>}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={st.container}>
      {/* Header */}
      <View style={st.headerRow}>
        <Text style={st.title}>Opportunities</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={st.viewToggle} onPress={() => setViewMode(v => v === 'list' ? 'kanban' : 'list')}>
            <Text style={st.viewToggleText}>{viewMode === 'list' ? '▦' : '☰'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.addBtn} onPress={() => nav.navigate('NewOpportunity')}>
            <Text style={st.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <TextInput style={st.searchInput} placeholder="Search opportunities..." value={search}
          onChangeText={t => { setSearch(t); setPage(1); }} placeholderTextColor="#94a3b8" />
        {search ? <TouchableOpacity onPress={() => { setSearch(''); setPage(1); }} style={st.clearBtn}><Text style={st.clearText}>✕</Text></TouchableOpacity> : null}
      </View>

      {/* Stage Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipScroll} contentContainerStyle={st.chipContainer}>
        {STAGES.map(s => (
          <TouchableOpacity key={s} style={[st.chip, stageFilter === s && st.chipActive]}
            onPress={() => { setStageFilter(s); setPage(1); }}>
            <Text style={[st.chipText, stageFilter === s && st.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={st.countText}>Showing {opps.length} of {total} opportunities</Text>

      {/* Content */}
      {isLoading && !refreshing ? (
        <View style={st.loadingWrap}><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : viewMode === 'list' ? (
        <>
          <FlatList
            data={opps}
            renderItem={renderOpp}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
            ListEmptyComponent={<Text style={st.emptyText}>No opportunities found</Text>}
          />
          {/* Pagination */}
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
      ) : (
        renderKanban()
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  viewToggle: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  viewToggleText: { fontSize: 18 },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  clearBtn: { paddingHorizontal: 12 },
  clearText: { fontSize: 16, color: '#94a3b8' },
  chipScroll: { minHeight: 44, maxHeight: 44, marginBottom: 8 },
  chipContainer: { paddingHorizontal: 16, paddingRight: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  countText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#64748b' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 40, fontSize: 14 },
  oppCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  oppHeader: { flexDirection: 'row', alignItems: 'center' },
  healthDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  oppName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  oppClient: { fontSize: 12, color: '#64748b', marginTop: 1 },
  stageBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  stageText: { fontSize: 11, fontWeight: '600' },
  oppMeta: { flexDirection: 'row', marginTop: 10, gap: 12 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  probWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  probTrack: { flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  probFill: { height: 6, borderRadius: 3 },
  probText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  oppFooter: { flexDirection: 'row', marginTop: 8, gap: 12 },
  footerText: { fontSize: 11, color: '#94a3b8' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#6366f1' },
  pageBtnDisabled: { backgroundColor: '#e2e8f0' },
  pageBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#64748b' },
  // Kanban
  kanbanCol: { width: width * 0.65, backgroundColor: '#f1f5f9', borderRadius: 12, marginHorizontal: 6, marginVertical: 8, padding: 8 },
  kanbanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 2, marginBottom: 8 },
  kanbanTitle: { fontSize: 13, fontWeight: '700' },
  kanbanCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  kanbanCountText: { fontSize: 11, fontWeight: '700' },
  kanbanCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  kanbanName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  kanbanClient: { fontSize: 11, color: '#64748b', marginTop: 2 },
  kanbanValue: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  kanbanHealthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  kanbanDays: { fontSize: 11, color: '#64748b' },
  kanbanEmpty: { textAlign: 'center', color: '#94a3b8', paddingVertical: 16, fontSize: 12 },
});
