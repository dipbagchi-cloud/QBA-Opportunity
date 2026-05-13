import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../lib/api';
import { colors, typography, spacing } from '../../theme';

interface SearchResults {
  opportunities: any[];
  contacts: any[];
  clients: any[];
  users: any[];
  projects: any[];
}

const EMPTY: SearchResults = { opportunities: [], contacts: [], clients: [], users: [], projects: [] };

type ResultItem = { type: string; icon: string; title: string; subtitle: string; id: string; navigateTo?: any };

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(EMPTY);
      setSearched(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data || EMPTY);
        setSearched(true);
      } catch {
        setResults(EMPTY);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const flatResults: ResultItem[] = [
    ...results.opportunities.map(o => ({
      type: 'Opportunity', icon: '💼', id: o.id,
      title: o.title,
      subtitle: `${o.client?.name || ''} • ${o.currentStage || ''}`,
    })),
    ...results.contacts.map(c => ({
      type: 'Contact', icon: '👤', id: c.id,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: `${c.title || ''} ${c.client?.name ? `at ${c.client.name}` : ''}`,
    })),
    ...results.clients.map(c => ({
      type: 'Client', icon: '🏢', id: c.id,
      title: c.name,
      subtitle: c.domain || c.industry || 'Client',
    })),
    ...results.users.map(u => ({
      type: 'User', icon: '👥', id: u.id,
      title: u.name,
      subtitle: `${u.email} ${u.department ? `• ${u.department}` : ''}`,
    })),
    ...(results.projects || []).map(p => ({
      type: 'Project', icon: '📁', id: p.id,
      title: p.title || p.name,
      subtitle: p.status || 'Project',
    })),
  ];

  const hasResults = flatResults.length > 0;

  const handleSelect = (item: ResultItem) => {
    Keyboard.dismiss();
    if (item.type === 'Opportunity') {
      nav.navigate('Opportunities', {
        screen: 'OpportunityDetail',
        params: { id: item.id },
      });
    } else if (item.type === 'Contact') {
      nav.navigate('Contacts');
    }
    // Other types just close — no dedicated screens for users/clients/projects yet
  };

  const renderItem = ({ item }: { item: ResultItem }) => (
    <TouchableOpacity style={st.resultItem} onPress={() => handleSelect(item)} activeOpacity={0.7}>
      <View style={st.resultIcon}>
        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.resultTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={st.resultSub} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <View style={st.typeBadge}>
        <Text style={st.typeText}>{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  // Group by type for section headers
  const sections: { type: string; data: ResultItem[] }[] = [];
  const grouped: Record<string, ResultItem[]> = {};
  flatResults.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });
  Object.entries(grouped).forEach(([type, data]) => sections.push({ type, data }));

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      {/* Search header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={st.backBtn}>
          <Text style={st.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={st.inputWrap}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={st.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search opportunities, contacts, clients..."
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={st.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
          <Text style={st.loadingText}>Searching...</Text>
        </View>
      ) : !searched ? (
        <View style={st.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
          <Text style={st.emptyTitle}>Search across Q-CRM</Text>
          <Text style={st.emptySub}>Find opportunities, contacts, clients, users & projects</Text>
        </View>
      ) : !hasResults ? (
        <View style={st.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>😔</Text>
          <Text style={st.emptyTitle}>No results found</Text>
          <Text style={st.emptySub}>Try a different search term</Text>
        </View>
      ) : (
        <FlatList
          data={flatResults}
          keyExtractor={(item, i) => `${item.type}-${item.id}-${i}`}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
          stickyHeaderIndices={[]}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border.light,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, color: colors.primary.DEFAULT, fontWeight: '300' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background.secondary, borderRadius: 12,
    paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border.light,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: colors.text.primary },
  clearIcon: { fontSize: 16, color: '#94a3b8', padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...typography.caption, color: colors.text.secondary, marginTop: 8 },
  emptyTitle: { ...typography.h4, color: colors.text.primary, marginBottom: 4 },
  emptySub: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: 40 },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.light,
  },
  resultIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  resultTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 2 },
  resultSub: { fontSize: 12, color: colors.text.secondary },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#eef2ff', marginLeft: 8,
  },
  typeText: { fontSize: 10, fontWeight: '600', color: '#6366f1' },
});
