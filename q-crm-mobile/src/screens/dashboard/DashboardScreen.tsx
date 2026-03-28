import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useCurrency } from '../../contexts/CurrencyContext';

const { width } = Dimensions.get('window');

const STAGE_COLORS: Record<string, string> = {
  Pipeline: '#6366f1', Qualification: '#f59e0b', Presales: '#f59e0b',
  Proposal: '#8b5cf6', Sales: '#8b5cf6', Negotiation: '#f97316',
  'Closed Won': '#10b981', 'Closed Lost': '#ef4444', 'Proposal Lost': '#e11d48',
  Discovery: '#06b6d4', Project: '#10b981',
};

export default function DashboardScreen() {
  const nav = useNavigation<any>();
  const user = useAuthStore(s => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const { formatCompact } = useCurrency();

  const { data: analytics, isLoading: aLoading, refetch: rA } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/api/analytics'),
  });
  const { data: oppsResult, isLoading: oLoading, refetch: rO } = useQuery({
    queryKey: ['recent-opps'],
    queryFn: () => api.get('/api/opportunities?limit=8'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([rA(), rO()]);
    setRefreshing(false);
  }, [rA, rO]);

  const isLoading = aLoading || oLoading;
  const dash = analytics?.dashboard;
  const pipeline = analytics?.pipeline;
  const sales = analytics?.sales;
  const presales = analytics?.presales;
  const opps = oppsResult?.data || [];

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={st.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';

  const kpis = [
    { label: 'Projected Revenue', value: formatCompact(dash?.projectedRevenue || 0), color: '#6366f1', icon: '💰' },
    { label: 'Closed Revenue', value: formatCompact(dash?.closedRevenue || 0), color: '#10b981', icon: '✅' },
    { label: 'Total Opportunities', value: `${pipeline?.totalOpps || 0}`, color: '#f59e0b', icon: '📊' },
    { label: 'Pipeline Value', value: formatCompact(pipeline?.pipelineValue || 0), color: '#8b5cf6', icon: '📈' },
    { label: 'Win Rate', value: `${(pipeline?.conversionRate || 0).toFixed(1)}%`, color: '#06b6d4', icon: '🎯' },
    { label: 'Avg Deal Size', value: formatCompact(pipeline?.avgDealValue || 0), color: '#f97316', icon: '💎' },
  ];

  return (
    <SafeAreaView style={st.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.greeting}>{greeting},</Text>
            <Text style={st.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity style={st.newBtn} onPress={() => nav.navigate('Opportunities', { screen: 'NewOpportunity' })}>
            <Text style={st.newBtnText}>+ New Deal</Text>
          </TouchableOpacity>
        </View>

        {/* KPI Cards */}
        <View style={st.kpiGrid}>
          {kpis.map((k, i) => (
            <View key={i} style={[st.kpiCard, { borderLeftColor: k.color }]}>
              <Text style={{ fontSize: 18 }}>{k.icon}</Text>
              <Text style={[st.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={st.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Stage Distribution */}
        {dash?.countByStatus?.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Stage Distribution</Text>
            {dash.countByStatus.map((s: any, i: number) => {
              const total = dash.countByStatus.reduce((a: number, b: any) => a + b.value, 0);
              const pct = total > 0 ? (s.value / total) * 100 : 0;
              return (
                <View key={i} style={st.barRow}>
                  <Text style={st.barLabel} numberOfLines={1}>{s.name}</Text>
                  <View style={st.barTrack}>
                    <View style={[st.barFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: STAGE_COLORS[s.name] || '#94a3b8' }]} />
                  </View>
                  <Text style={st.barValue}>{s.value}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Revenue by Technology */}
        {dash?.revenueByTech?.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Revenue by Technology</Text>
            {dash.revenueByTech.slice(0, 6).map((t: any, i: number) => {
              const max = Math.max(...dash.revenueByTech.map((x: any) => x.value));
              const pct = max > 0 ? (t.value / max) * 100 : 0;
              return (
                <View key={i} style={st.barRow}>
                  <Text style={st.barLabel} numberOfLines={1}>{t.name}</Text>
                  <View style={st.barTrack}><View style={[st.barFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: '#6366f1' }]} /></View>
                  <Text style={st.barValue}>{formatCompact(t.value)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Revenue by Client */}
        {dash?.revenueByClient?.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Revenue by Client</Text>
            {dash.revenueByClient.slice(0, 6).map((c: any, i: number) => {
              const max = Math.max(...dash.revenueByClient.map((x: any) => x.value));
              const pct = max > 0 ? (c.value / max) * 100 : 0;
              return (
                <View key={i} style={st.barRow}>
                  <Text style={st.barLabel} numberOfLines={1}>{c.name}</Text>
                  <View style={st.barTrack}><View style={[st.barFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: '#10b981' }]} /></View>
                  <Text style={st.barValue}>{formatCompact(c.value)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Sales Performance */}
        {sales && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Sales Performance</Text>
            <View style={st.statsRow}>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#10b981' }]}>{sales.wonCount || 0}</Text><Text style={st.statLbl}>Won</Text></View>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#ef4444' }]}>{sales.lostCount || 0}</Text><Text style={st.statLbl}>Lost</Text></View>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#6366f1' }]}>{Math.round(sales.avgTimeToClose || 0)}d</Text><Text style={st.statLbl}>Avg Close</Text></View>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#f59e0b' }]}>{pipeline?.activeProjects || 0}</Text><Text style={st.statLbl}>Active</Text></View>
            </View>
          </View>
        )}

        {/* Presales Metrics */}
        {presales && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Presales Metrics</Text>
            <View style={st.statsRow}>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#8b5cf6' }]}>{(presales.proposalSuccessRate || 0).toFixed(0)}%</Text><Text style={st.statLbl}>Success Rate</Text></View>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#f97316' }]}>{presales.avgReEstimateIterations?.toFixed(1) || '0'}</Text><Text style={st.statLbl}>Re-estimates</Text></View>
              <View style={st.statItem}><Text style={[st.statVal, { color: '#06b6d4' }]}>{presales.totalPresalesOpps || 0}</Text><Text style={st.statLbl}>Total Opps</Text></View>
            </View>
          </View>
        )}

        {/* Revenue by Sales Owner */}
        {dash?.revenueByOwner?.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Revenue by Sales Owner</Text>
            {dash.revenueByOwner.slice(0, 6).map((o: any, i: number) => {
              const max = Math.max(...dash.revenueByOwner.map((x: any) => x.revenue));
              const pct = max > 0 ? (o.revenue / max) * 100 : 0;
              return (
                <View key={i} style={st.barRow}>
                  <Text style={st.barLabel} numberOfLines={1}>{o.name}</Text>
                  <View style={st.barTrack}><View style={[st.barFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: '#f97316' }]} /></View>
                  <Text style={st.barValue}>{formatCompact(o.revenue)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Opportunities */}
        <View style={st.card}>
          <View style={st.cardHdr}>
            <Text style={st.cardTitle}>Recent Opportunities</Text>
            <TouchableOpacity onPress={() => nav.navigate('Opportunities', { screen: 'OpportunitiesList' })}>
              <Text style={st.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {opps.length === 0 && <Text style={st.empty}>No opportunities yet</Text>}
          {opps.slice(0, 8).map((opp: any) => (
            <TouchableOpacity key={opp.id} style={st.oppRow}
              onPress={() => nav.navigate('Opportunities', { screen: 'OpportunityDetail', params: { id: opp.id } })}>
              <View style={st.oppLeft}>
                <View style={[st.dot, { backgroundColor: opp.status === 'healthy' ? '#10b981' : opp.status === 'at-risk' ? '#f59e0b' : '#ef4444' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.oppName} numberOfLines={1}>{opp.name}</Text>
                  <Text style={st.oppSub}>{opp.client} • {opp.owner}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.oppVal}>{formatCompact(opp.value || 0)}</Text>
                <View style={[st.badge, { backgroundColor: (STAGE_COLORS[opp.stage] || '#94a3b8') + '20' }]}>
                  <Text style={[st.badgeText, { color: STAGE_COLORS[opp.stage] || '#94a3b8' }]}>{opp.stage}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Manager KPI */}
        {sales?.managerKpi?.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>Manager Response KPI</Text>
            {sales.managerKpi.map((m: any, i: number) => (
              <View key={i} style={st.kpiRow}>
                <Text style={st.kpiRowName}>{m.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={st.kpiRowStat}>{m.responded}/{m.totalAssigned}</Text>
                  <Text style={[st.kpiRowPct, { color: (m.responded / m.totalAssigned) > 0.8 ? '#10b981' : '#f59e0b' }]}>
                    {m.totalAssigned > 0 ? ((m.responded / m.totalAssigned) * 100).toFixed(0) : 0}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  greeting: { fontSize: 14, color: '#64748b' },
  userName: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  newBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  kpiCard: { width: (width - 40) / 2, backgroundColor: '#fff', borderRadius: 12, padding: 14, margin: 4, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  kpiValue: { fontSize: 20, fontWeight: '700' },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, margin: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  seeAll: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barLabel: { width: 80, fontSize: 12, color: '#334155' },
  barTrack: { flex: 1, height: 18, backgroundColor: '#f1f5f9', borderRadius: 9, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: 18, borderRadius: 9 },
  barValue: { width: 60, fontSize: 12, color: '#334155', textAlign: 'right', fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 22, fontWeight: '700' },
  statLbl: { fontSize: 11, color: '#64748b', marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', paddingVertical: 20 },
  oppRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  oppLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  oppName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  oppSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  oppVal: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  kpiRowName: { fontSize: 13, color: '#334155', flex: 1 },
  kpiRowStat: { fontSize: 13, color: '#64748b', marginRight: 8 },
  kpiRowPct: { fontSize: 14, fontWeight: '700' },
});
