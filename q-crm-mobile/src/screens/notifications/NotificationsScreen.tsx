import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { colors, typography, spacing } from '../../theme';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'opportunity_created': return '💼';
    case 'stage_change': return '📊';
    case 'gom_approved': return '✅';
    case 'gom_revoked': return '❌';
    case 'comment_added': return '💬';
    case 'assignment': return '👤';
    case 'approval_request': return '🔔';
    case 'approval_response': return '📋';
    default: return '🔔';
  }
}

export default function NotificationsScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications?limit=50'),
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () => api.patch('/api/notifications/read-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const notifications: NotificationItem[] = data?.notifications || data?.data || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePress = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMut.mutate(item.id);
    }
    // Navigate to opportunity if link contains opportunity ID
    if (item.link) {
      const oppMatch = item.link.match(/opportunities\/([a-f0-9-]+)/i);
      if (oppMatch) {
        nav.navigate('Opportunities', {
          screen: 'OpportunityDetail',
          params: { id: oppMatch[1] },
        });
      }
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[st.item, !item.isRead && st.itemUnread]}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      <View style={st.iconWrap}>
        <Text style={st.icon}>{getTypeIcon(item.type)}</Text>
      </View>
      <View style={st.content}>
        <Text style={[st.title, !item.isRead && st.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={st.message} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={st.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={st.dot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={st.backBtn}>
          <Text style={st.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={st.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => markAllReadMut.mutate()} disabled={markAllReadMut.isPending}>
            <Text style={st.markAllText}>
              {markAllReadMut.isPending ? 'Marking...' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={st.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔔</Text>
          <Text style={st.emptyTitle}>No notifications</Text>
          <Text style={st.emptySub}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.light,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, color: colors.primary.DEFAULT, fontWeight: '300' },
  headerTitle: { ...typography.h4, color: colors.text.primary, fontWeight: '600' },
  headerSub: { ...typography.caption, color: colors.text.secondary },
  markAllText: { fontSize: 13, color: colors.primary.DEFAULT, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.h4, color: colors.text.primary, marginBottom: 4 },
  emptySub: { ...typography.caption, color: colors.text.secondary },
  item: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border.light,
    backgroundColor: colors.white,
  },
  itemUnread: { backgroundColor: '#eef2ff' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  title: { fontSize: 14, color: colors.text.primary, marginBottom: 2 },
  titleUnread: { fontWeight: '700' },
  message: { fontSize: 12, color: colors.text.secondary, lineHeight: 18, marginBottom: 4 },
  time: { fontSize: 11, color: '#94a3b8' },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary.DEFAULT, alignSelf: 'center', marginLeft: 8,
  },
});
