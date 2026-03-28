import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { colors, typography } from '../../theme';

// ─── Types ───
interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  actions?: { tool: string; success: boolean; summary: string }[];
  pendingFields?: string[];
  timestamp: Date;
}

// ─── Simple Bar Chart Component ───
function BarChart({ data }: { data: any }) {
  if (!data?.labels?.length) return null;
  const dataset = data.datasets?.[0];
  if (!dataset?.data?.length) return null;
  const maxVal = Math.max(...dataset.data, 1);

  return (
    <View style={styles.chartContainer}>
      {data.title && <Text style={styles.chartTitle}>{data.title}</Text>}
      {data.labels.map((label: string, i: number) => (
        <View key={label} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
          <View style={styles.barTrack}>
            <View
              style={[styles.barFill, { width: `${(dataset.data[i] / maxVal) * 100}%` }]}
            />
          </View>
          <Text style={styles.barValue}>{dataset.data[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Data Table Component ───
function DataTable({ data }: { data: any }) {
  if (!data?.rows?.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          {(data.columns || []).map((col: string) => (
            <Text key={col} style={styles.tableHeaderCell}>{col}</Text>
          ))}
        </View>
        {data.rows.slice(0, 8).map((row: any, i: number) => (
          <View key={row.id || i} style={styles.tableRow}>
            <Text style={styles.tableCell}>{row.title}</Text>
            <Text style={styles.tableCellSecondary}>{row.client}</Text>
            <View style={[styles.stageBadge, getStageStyle(row.stage)]}>
              <Text style={styles.stageBadgeText}>{row.stage}</Text>
            </View>
            <Text style={styles.tableCell}>${(row.value / 1000).toFixed(0)}K</Text>
            <Text style={styles.tableCellSecondary}>{row.owner}</Text>
          </View>
        ))}
        {data.rows.length > 8 && (
          <Text style={styles.tableFooter}>Showing 8 of {data.rows.length}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function getStageStyle(stage: string) {
  if (stage === 'Closed Won') return { backgroundColor: '#dcfce7' };
  if (stage === 'Closed Lost') return { backgroundColor: '#fee2e2' };
  return { backgroundColor: '#eef2ff' };
}

// ─── Opportunity Detail Component ───
function OpportunityDetail({ data }: { data: any }) {
  const opp = data?.opportunity;
  if (!opp) return null;

  const fields = [
    ['Client', opp.client],
    ['Stage', opp.stage],
    ['Value', `${opp.currency || 'USD'} ${Number(opp.value).toLocaleString()}`],
    ['Owner', opp.owner],
    ['Technology', opp.technology],
    ['Region', opp.region],
    ['Priority', opp.priority],
    ['Probability', opp.probability != null ? `${opp.probability}%` : null],
    ['GOM Approved', opp.gomApproved != null ? (opp.gomApproved ? 'Yes' : 'No') : null],
    ['Pricing Model', opp.pricingModel],
    ['Day Rate', opp.projectType === 'Staffing' && opp.expectedDayRate ? `$${Number(opp.expectedDayRate).toLocaleString()}` : null],
    ['Re-estimates', opp.reEstimateCount > 0 ? String(opp.reEstimateCount) : null],
  ].filter(([, v]) => v && v !== '—' && v !== 'null');

  return (
    <View style={styles.detailContainer}>
      {fields.map(([label, value]) => (
        <View key={label as string} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{label}:</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Health Report Component ───
function HealthReport({ data }: { data: any }) {
  if (!data) return null;

  return (
    <View style={styles.healthContainer}>
      {data.stalled?.length > 0 && (
        <View style={styles.healthSection}>
          <Text style={styles.healthTitleRed}>⚠️ Stalled ({data.stalled.length})</Text>
          {data.stalled.slice(0, 3).map((d: any) => (
            <Text key={d.id} style={styles.healthItem}>
              {d.title} — {d.daysSinceUpdate}d — ${(d.value / 1000).toFixed(0)}K
            </Text>
          ))}
        </View>
      )}
      {data.atRisk?.length > 0 && (
        <View style={styles.healthSection}>
          <Text style={styles.healthTitleAmber}>⚠️ At Risk ({data.atRisk.length})</Text>
          {data.atRisk.slice(0, 3).map((d: any) => (
            <Text key={d.id} style={styles.healthItem}>
              {d.title} — {d.daysSinceUpdate}d — ${(d.value / 1000).toFixed(0)}K
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Data Block Renderer ───
function DataBlock({ data }: { data: any }) {
  if (!data) return null;
  if (data.type === 'chart') return <BarChart data={data} />;
  if (data.type === 'table') return <DataTable data={data} />;
  if (data.type === 'detail') return <OpportunityDetail data={data} />;
  if (data.type === 'health') return <HealthReport data={data} />;
  return null;
}

// ─── Main Chatbot Screen ───
export default function ChatbotScreen() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Load suggestions on mount
  useEffect(() => {
    api.get<{ suggestions: string[] }>('/api/chatbot/suggestions')
      .then(res => setSuggestions(res.suggestions || []))
      .catch(() => {});
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMsg = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post<any>('/api/chatbot/message', { message: text.trim() });
      const botMsg: ChatMsg = {
        role: 'assistant',
        content: res.content,
        data: res.data,
        actions: res.actions,
        pendingFields: res.pendingFields,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}`,
        timestamp: new Date(),
      }]);
    }
    setLoading(false);
  }, [loading]);

  const renderMessage = ({ item, index }: { item: ChatMsg; index: number }) => {
    const isUser = item.role === 'user';
    const isLast = index === messages.length - 1;
    const showConfirm = !isUser && item.content.includes('**"yes"**') && isLast && !loading;

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleBot]}>
          {!isUser && (
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>✨</Text>
              <Text style={styles.aiLabel}>AI</Text>
            </View>
          )}
          <Text style={[styles.msgText, isUser && styles.msgTextUser]}>
            {formatContent(item.content)}
          </Text>
          {item.data && <DataBlock data={item.data} />}

          {/* Confirmation buttons */}
          {showConfirm && (
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.confirmYes} onPress={() => sendMessage('yes')}>
                <Text style={styles.confirmText}>✓ Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmNo} onPress={() => sendMessage('no')}>
                <Text style={styles.confirmText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pending fields indicator */}
          {!isUser && item.pendingFields && item.pendingFields.length > 0 && isLast && (
            <Text style={styles.pendingText}>
              🔄 {item.pendingFields.length} field{item.pendingFields.length > 1 ? 's' : ''} remaining
            </Text>
          )}

          <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // Format content (bold text handling)
  const formatContent = (content: string) => {
    return content.replace(/\*\*([^*]+)\*\*/g, '$1');
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>How can I help you?</Text>
      <Text style={styles.emptySubtitle}>Ask me about your deals, pipeline, or analytics</Text>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsGrid}>
          {suggestions.slice(0, 6).map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.loadingRow}>
        <View style={styles.loadingBubble}>
          <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>✨</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Q-CRM AI Assistant</Text>
          <Text style={styles.headerSubtitle}>Ask about opportunities, analytics & more</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Quick suggestions after first message */}
      {messages.length > 0 && suggestions.length > 0 && !loading && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSuggestions}>
          {suggestions.slice(0, 4).map((s, i) => (
            <TouchableOpacity key={i} style={styles.quickChip} onPress={() => sendMessage(s)}>
              <Text style={styles.quickChipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            placeholderTextColor={colors.text.secondary}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary.DEFAULT,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.white,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  messagesContent: {
    padding: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  msgRow: {
    marginBottom: 12,
  },
  msgRowUser: {
    alignItems: 'flex-end',
  },
  msgRowBot: {
    alignItems: 'flex-start',
  },
  msgBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  msgBubbleUser: {
    backgroundColor: colors.primary.DEFAULT,
  },
  msgBubbleBot: {
    backgroundColor: colors.background.secondary,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  aiIcon: {
    fontSize: 12,
  },
  aiLabel: {
    ...typography.caption,
    color: colors.primary.DEFAULT,
    fontWeight: '600',
    fontSize: 10,
  },
  msgText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 20,
  },
  msgTextUser: {
    color: colors.white,
  },
  timestamp: {
    ...typography.caption,
    color: colors.gray[400],
    marginTop: 4,
    fontSize: 10,
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.5)',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  confirmYes: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  confirmNo: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  confirmText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
  pendingText: {
    ...typography.caption,
    color: colors.primary.DEFAULT,
    marginTop: 8,
    fontSize: 10,
  },
  loadingRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  loadingText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  quickSuggestions: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    marginRight: 8,
  },
  quickChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.white,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background.secondary,
    borderRadius: 22,
    paddingHorizontal: 16,
    ...typography.body,
    color: colors.text.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border.DEFAULT,
  },
  sendIcon: {
    fontSize: 18,
    color: colors.white,
  },
  // Chart styles
  chartContainer: {
    marginTop: 10,
  },
  chartTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  barLabel: {
    width: 70,
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'right',
    marginRight: 8,
    fontSize: 10,
  },
  barTrack: {
    flex: 1,
    height: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary[300],
    borderRadius: 4,
  },
  barValue: {
    width: 40,
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'right',
    marginLeft: 8,
    fontSize: 10,
    fontWeight: '600',
  },
  // Table styles
  tableScroll: {
    marginTop: 10,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
    width: 80,
    fontSize: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  tableCell: {
    ...typography.caption,
    color: colors.text.primary,
    width: 80,
    fontSize: 10,
  },
  tableCellSecondary: {
    ...typography.caption,
    color: colors.text.secondary,
    width: 80,
    fontSize: 10,
  },
  stageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  stageBadgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '600',
  },
  tableFooter: {
    ...typography.caption,
    color: colors.gray[400],
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: colors.background.secondary,
    fontSize: 10,
  },
  // Detail styles
  detailContainer: {
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
    marginRight: 4,
    fontSize: 11,
  },
  detailValue: {
    ...typography.caption,
    color: colors.text.primary,
    flex: 1,
    fontSize: 11,
  },
  // Health styles
  healthContainer: {
    marginTop: 10,
  },
  healthSection: {
    marginBottom: 8,
  },
  healthTitleRed: {
    ...typography.caption,
    color: '#dc2626',
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 11,
  },
  healthTitleAmber: {
    ...typography.caption,
    color: '#d97706',
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 11,
  },
  healthItem: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: 8,
    marginBottom: 2,
    fontSize: 10,
  },
});
