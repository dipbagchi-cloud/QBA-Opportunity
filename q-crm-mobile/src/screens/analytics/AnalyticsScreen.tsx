import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCurrency } from '../../contexts/CurrencyContext';

const { width } = Dimensions.get('window');
const TABS = ['Dashboard', 'Pipeline', 'Presales', 'Sales'];

export default function AnalyticsScreen() {
  const [tab, setTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { formatCompact } = useCurrency();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/api/analytics'),
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await refetch(); setRefreshing(false);
  }, [refetch]);

  if (isLoading && !refreshing) return <View style={st.loadWrap}><ActivityIndicator size="large" color="#6366f1" /></View>;

  const dashboard = data?.dashboard || {};
  const pipeline = data?.pipeline || {};
  const presales = data?.presales || {};
  const sales = data?.sales || {};

  return (
    <SafeAreaView style={st.container}>
      <Text style={st.title}>Analytics</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabScroll} contentContainerStyle={st.tabContainer}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[st.tab, tab === i && st.tabActive]} onPress={() => setTab(i)}>
            <Text style={[st.tabText, tab === i && st.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>

        {/* === TAB 0: DASHBOARD === */}
        {tab === 0 && (
          <>
            <View style={st.kpiGrid}>
              <KpiCard label="Projected Revenue" value={formatCompact(dashboard.projectedRevenue)} color="#6366f1" />
              <KpiCard label="Closed Revenue" value={formatCompact(dashboard.closedRevenue)} color="#10b981" />
              <KpiCard label="Total Opportunities" value={String(dashboard.totalOpportunities || 0)} color="#f59e0b" />
              <KpiCard label="Pipeline Value" value={formatCompact(dashboard.pipelineValue)} color="#8b5cf6" />
              <KpiCard label="Win Rate" value={`${(dashboard.winRate || 0).toFixed(1)}%`} color="#10b981" />
              <KpiCard label="Avg Deal Size" value={formatCompact(dashboard.avgDealSize)} color="#f97316" />
            </View>

            {/* Stage Distribution */}
            <SectionCard title="Stage Distribution">
              {(dashboard.stageDistribution || []).map((s: any) => {
                const max = Math.max(...(dashboard.stageDistribution || []).map((x: any) => x.count || 0), 1);
                return (
                  <View key={s.stage || s.name} style={st.barRow}>
                    <Text style={st.barLabel}>{s.stage || s.name}</Text>
                    <View style={st.barTrack}>
                      <View style={[st.barFill, { width: `${((s.count || 0) / max) * 100}%` }]} />
                    </View>
                    <Text style={st.barCount}>{s.count || 0}</Text>
                  </View>
                );
              })}
            </SectionCard>

            {/* Revenue by Client */}
            <SectionCard title="Revenue by Client">
              {(dashboard.revenueByClient || []).slice(0, 8).map((c: any, i: number) => (
                <View key={i} style={st.listRow}>
                  <Text style={st.listLabel}>{c.client || c.name}</Text>
                  <Text style={st.listValue}>{formatCompact(c.revenue || c.value)}</Text>
                </View>
              ))}
            </SectionCard>

            {/* Revenue by Technology */}
            <SectionCard title="Revenue by Technology">
              {(dashboard.revenueByTechnology || []).slice(0, 8).map((t: any, i: number) => (
                <View key={i} style={st.listRow}>
                  <Text style={st.listLabel}>{t.technology || t.name}</Text>
                  <Text style={st.listValue}>{formatCompact(t.revenue || t.value)}</Text>
                </View>
              ))}
            </SectionCard>

            {/* Sales Performance */}
            <SectionCard title="Sales Performance">
              <View style={st.statsRow}>
                <StatBox label="Won" value={String(dashboard.wonCount || 0)} color="#10b981" />
                <StatBox label="Lost" value={String(dashboard.lostCount || 0)} color="#ef4444" />
                <StatBox label="Avg Close" value={`${dashboard.avgCloseDays || 0}d`} color="#6366f1" />
                <StatBox label="Active" value={String(dashboard.activeCount || 0)} color="#f59e0b" />
              </View>
            </SectionCard>
          </>
        )}

        {/* === TAB 1: PIPELINE === */}
        {tab === 1 && (
          <>
            <View style={st.kpiGrid}>
              <KpiCard label="Total Pipeline" value={formatCompact(pipeline.totalValue)} color="#6366f1" />
              <KpiCard label="Deals in Pipeline" value={String(pipeline.totalCount || 0)} color="#f59e0b" />
              <KpiCard label="Avg Probability" value={`${(pipeline.avgProbability || 0).toFixed(0)}%`} color="#10b981" />
              <KpiCard label="Weighted Value" value={formatCompact(pipeline.weightedValue)} color="#8b5cf6" />
            </View>

            {/* Pipeline Stages */}
            <SectionCard title="By Stage">
              {(pipeline.stageBreakdown || pipeline.stages || []).map((s: any) => (
                <View key={s.stage || s.name} style={st.pipelineRow}>
                  <View style={st.pipelineInfo}>
                    <Text style={st.pipelineStageName}>{s.stage || s.name}</Text>
                    <Text style={st.pipelineCount}>{s.count} deals</Text>
                  </View>
                  <Text style={st.pipelineValue}>{formatCompact(s.value)}</Text>
                </View>
              ))}
            </SectionCard>

            {/* By Region */}
            <SectionCard title="By Region">
              {(pipeline.byRegion || []).map((r: any, i: number) => (
                <View key={i} style={st.listRow}>
                  <Text style={st.listLabel}>{r.region || r.name}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.listValue}>{formatCompact(r.value)}</Text>
                    <Text style={st.listSub}>{r.count} deals</Text>
                  </View>
                </View>
              ))}
            </SectionCard>

            {/* By Sales Owner */}
            <SectionCard title="By Sales Owner">
              {(pipeline.bySalesOwner || pipeline.byOwner || []).map((o: any, i: number) => (
                <View key={i} style={st.listRow}>
                  <Text style={st.listLabel}>{o.owner || o.name || o.salesRepName}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.listValue}>{formatCompact(o.value)}</Text>
                    <Text style={st.listSub}>{o.count} deals</Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          </>
        )}

        {/* === TAB 2: PRESALES === */}
        {tab === 2 && (
          <>
            <View style={st.kpiGrid}>
              <KpiCard label="Success Rate" value={`${(presales.successRate || 0).toFixed(1)}%`} color="#10b981" />
              <KpiCard label="Re-estimates" value={String(presales.reEstimateCount || 0)} color="#f59e0b" />
              <KpiCard label="Total" value={String(presales.totalCount || 0)} color="#6366f1" />
              <KpiCard label="Avg GOM %" value={`${(presales.avgGomPercent || 0).toFixed(1)}%`} color="#8b5cf6" />
            </View>

            {/* Manager KPIs */}
            <SectionCard title="Manager Response KPIs">
              {(presales.managerKpis || presales.managers || []).map((m: any, i: number) => (
                <View key={i} style={st.managerRow}>
                  <Text style={st.managerName}>{m.name || m.managerName}</Text>
                  <View style={st.managerStats}>
                    <View style={st.managerStat}>
                      <Text style={st.managerStatLabel}>Total</Text>
                      <Text style={st.managerStatValue}>{m.total || m.count || 0}</Text>
                    </View>
                    <View style={st.managerStat}>
                      <Text style={st.managerStatLabel}>Won</Text>
                      <Text style={[st.managerStatValue, { color: '#10b981' }]}>{m.won || 0}</Text>
                    </View>
                    <View style={st.managerStat}>
                      <Text style={st.managerStatLabel}>Lost</Text>
                      <Text style={[st.managerStatValue, { color: '#ef4444' }]}>{m.lost || 0}</Text>
                    </View>
                    <View style={st.managerStat}>
                      <Text style={st.managerStatLabel}>Avg Days</Text>
                      <Text style={st.managerStatValue}>{m.avgDays || m.avgResponseDays || 0}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {(presales.managerKpis || presales.managers || []).length === 0 && (
                <Text style={st.emptyText}>No manager data available</Text>
              )}
            </SectionCard>

            {/* Re-estimate Analysis */}
            <SectionCard title="Re-estimate Analysis">
              <View style={st.statsRow}>
                <StatBox label="Total Re-est" value={String(presales.reEstimateCount || 0)} color="#f59e0b" />
                <StatBox label="Avg Re-est" value={`${(presales.avgReEstimates || 0).toFixed(1)}`} color="#6366f1" />
              </View>
            </SectionCard>

            {/* GOM Analysis */}
            <SectionCard title="GOM Analysis">
              <FieldRow label="Approved" value={String(presales.gomApprovedCount || 0)} />
              <FieldRow label="Pending" value={String(presales.gomPendingCount || 0)} />
              <FieldRow label="Avg GOM %" value={`${(presales.avgGomPercent || 0).toFixed(1)}%`} />
              <FieldRow label="Target GOM %" value={`${presales.targetGomPercent || 25}%`} />
            </SectionCard>
          </>
        )}

        {/* === TAB 3: SALES & CONVERSION === */}
        {tab === 3 && (
          <>
            <View style={st.kpiGrid}>
              <KpiCard label="Win Rate" value={`${(sales.winRate || 0).toFixed(1)}%`} color="#10b981" />
              <KpiCard label="Closed Won" value={String(sales.wonCount || 0)} color="#10b981" />
              <KpiCard label="Closed Lost" value={String(sales.lostCount || 0)} color="#ef4444" />
              <KpiCard label="Avg Close Days" value={String(sales.avgCloseDays || 0)} color="#6366f1" />
            </View>

            {/* Won vs Lost */}
            <SectionCard title="Won vs Lost">
              <View style={st.wonLostBar}>
                <View style={[st.wonPart, { flex: sales.wonCount || 1 }]}>
                  <Text style={st.wonPartText}>Won: {sales.wonCount || 0}</Text>
                </View>
                <View style={[st.lostPart, { flex: sales.lostCount || 1 }]}>
                  <Text style={st.lostPartText}>Lost: {sales.lostCount || 0}</Text>
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <FieldRow label="Won Revenue" value={formatCompact(sales.wonRevenue)} />
                <FieldRow label="Lost Revenue" value={formatCompact(sales.lostRevenue)} />
                <FieldRow label="Revenue Ratio" value={`${((sales.wonRevenue || 0) / Math.max((sales.wonRevenue || 0) + (sales.lostRevenue || 0), 1) * 100).toFixed(0)}%`} />
              </View>
            </SectionCard>

            {/* Loss Reasons */}
            <SectionCard title="Loss Reasons">
              {(sales.lossReasons || []).map((r: any, i: number) => (
                <View key={i} style={st.listRow}>
                  <Text style={st.listLabel}>{r.reason || r.name || 'Unspecified'}</Text>
                  <Text style={st.listValue}>{r.count || 0}</Text>
                </View>
              ))}
              {(sales.lossReasons || []).length === 0 && <Text style={st.emptyText}>No loss data</Text>}
            </SectionCard>

            {/* Conversion by Source */}
            <SectionCard title="Conversion Funnel">
              <FieldRow label="Pipeline → Presales" value={`${(sales.pipelineToPresales || 0).toFixed(0)}%`} />
              <FieldRow label="Presales → Sales" value={`${(sales.presalesToSales || 0).toFixed(0)}%`} />
              <FieldRow label="Sales → Won" value={`${(sales.salesToWon || 0).toFixed(0)}%`} />
              <FieldRow label="Overall Conversion" value={`${(sales.overallConversion || sales.winRate || 0).toFixed(1)}%`} />
            </SectionCard>

            {/* Revenue by Sales Owner */}
            <SectionCard title="Revenue by Sales Owner">
              {(sales.bySalesOwner || []).map((o: any, i: number) => (
                <View key={i} style={st.listRow}>
                  <Text style={st.listLabel}>{o.owner || o.name || o.salesRepName}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.listValue}>{formatCompact(o.wonRevenue || o.value)}</Text>
                    <Text style={st.listSub}>Win: {o.wonCount || 0} / Lost: {o.lostCount || 0}</Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// === COMPONENTS ===

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={st.kpiCard}>
      <Text style={st.kpiLabel}>{label}</Text>
      <Text style={[st.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.sectionCard}>
      <Text style={st.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={st.statBox}>
      <Text style={[st.statValue, { color }]}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.fieldRow}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Text style={st.fieldValue}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tabScroll: { maxHeight: 44, marginBottom: 4 },
  tabContainer: { paddingHorizontal: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpiCard: { flex: 1, minWidth: '45%' as any, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  kpiLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: '700' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  barLabel: { width: 80, fontSize: 11, color: '#64748b' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#6366f1', borderRadius: 4 },
  barCount: { width: 28, fontSize: 12, fontWeight: '600', color: '#0f172a', textAlign: 'right' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  listLabel: { fontSize: 13, color: '#334155', flex: 1 },
  listValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  listSub: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 12, fontSize: 13 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  fieldLabel: { fontSize: 13, color: '#64748b' },
  fieldValue: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  pipelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  pipelineInfo: {},
  pipelineStageName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  pipelineCount: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  pipelineValue: { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  managerRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  managerName: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  managerStats: { flexDirection: 'row', gap: 12 },
  managerStat: { alignItems: 'center' },
  managerStatLabel: { fontSize: 10, color: '#94a3b8' },
  managerStatValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  wonLostBar: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', height: 36 },
  wonPart: { backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  wonPartText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  lostPart: { backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  lostPartText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
