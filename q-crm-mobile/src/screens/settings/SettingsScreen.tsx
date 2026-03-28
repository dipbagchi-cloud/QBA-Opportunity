import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, removeAuthToken } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { useCurrency } from '../../contexts/CurrencyContext';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { currency, setCurrency, availableCurrencies } = useCurrency();
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Change password mutation
  const passwordMut = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/api/auth/change-password', body),
    onSuccess: () => {
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordSection(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Required', 'All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirm password do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters');
      return;
    }
    passwordMut.mutate({ currentPassword, newPassword });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await removeAuthToken();
          logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={st.title}>Settings</Text>

        {/* Profile */}
        <View style={st.card}>
          <Text style={st.cardTitle}>👤 Profile</Text>
          <View style={st.profileHeader}>
            <View style={st.avatar}>
              <Text style={st.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.profileName}>{user?.name || 'User'}</Text>
              <Text style={st.profileEmail}>{user?.email || ''}</Text>
              <Text style={st.profileRole}>{user?.role?.name || user?.roles?.[0]?.name || 'User'}</Text>
            </View>
          </View>
          <View style={st.divider} />
          <FieldRow label="Department" value={user?.department || '-'} />
          <FieldRow label="Title" value={user?.title || '-'} />
          <FieldRow label="Team" value={user?.team?.name || '-'} />
        </View>

        {/* Security */}
        <View style={st.card}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>🔒 Security</Text>
            <TouchableOpacity onPress={() => setShowPasswordSection(!showPasswordSection)}>
              <Text style={st.linkText}>{showPasswordSection ? 'Cancel' : 'Change Password'}</Text>
            </TouchableOpacity>
          </View>
          {showPasswordSection && (
            <View>
              <Text style={st.label}>Current Password</Text>
              <TextInput style={st.input} value={currentPassword} onChangeText={setCurrentPassword}
                secureTextEntry placeholder="Enter current password" placeholderTextColor="#94a3b8" />

              <Text style={st.label}>New Password</Text>
              <TextInput style={st.input} value={newPassword} onChangeText={setNewPassword}
                secureTextEntry placeholder="Enter new password" placeholderTextColor="#94a3b8" />

              <Text style={st.label}>Confirm Password</Text>
              <TextInput style={st.input} value={confirmPassword} onChangeText={setConfirmPassword}
                secureTextEntry placeholder="Confirm new password" placeholderTextColor="#94a3b8" />

              <TouchableOpacity style={st.primaryBtn} onPress={handleChangePassword}
                disabled={passwordMut.isPending}>
                {passwordMut.isPending ? <ActivityIndicator color="#fff" /> :
                  <Text style={st.primaryBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Currency */}
        <View style={st.card}>
          <Text style={st.cardTitle}>💱 Currency</Text>
          <Text style={st.hint}>Select display currency for values</Text>
          <View style={st.currencyGrid}>
            {availableCurrencies.map(c => (
              <TouchableOpacity key={c.code} style={[st.currencyItem, currency.code === c.code && st.currencyItemActive]}
                onPress={() => setCurrency(c.code)}>
                <Text style={[st.currencySymbol, currency.code === c.code && st.currencySymbolActive]}>{c.symbol}</Text>
                <Text style={[st.currencyCode, currency.code === c.code && st.currencyCodeActive]}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={st.card}>
          <Text style={st.cardTitle}>🔔 Notifications</Text>
          <View style={st.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.switchLabel}>Push Notifications</Text>
              <Text style={st.switchDesc}>Receive push alerts for updates</Text>
            </View>
            <Switch value={pushNotifications} onValueChange={setPushNotifications}
              trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }} thumbColor={pushNotifications ? '#6366f1' : '#94a3b8'} />
          </View>
          <View style={st.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.switchLabel}>Email Notifications</Text>
              <Text style={st.switchDesc}>Receive email digests</Text>
            </View>
            <Switch value={emailNotifications} onValueChange={setEmailNotifications}
              trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }} thumbColor={emailNotifications ? '#6366f1' : '#94a3b8'} />
          </View>
        </View>

        {/* About */}
        <View style={st.card}>
          <Text style={st.cardTitle}>ℹ️ About</Text>
          <FieldRow label="App Version" value="1.0.0" />
          <FieldRow label="Platform" value="Q-CRM Mobile" />
          <FieldRow label="Backend" value="20.124.178.41:3001" />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut}>
          <Text style={st.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  profileEmail: { fontSize: 13, color: '#64748b', marginTop: 1 },
  profileRole: { fontSize: 12, color: '#6366f1', fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  fieldLabel: { fontSize: 13, color: '#64748b' },
  fieldValue: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  linkText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  primaryBtn: { marginTop: 16, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint: { fontSize: 12, color: '#94a3b8', marginBottom: 10 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyItem: { width: '30%' as any, flex: 1, minWidth: 95, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  currencyItemActive: { borderColor: '#6366f1', backgroundColor: '#f0f0ff' },
  currencySymbol: { fontSize: 22, fontWeight: '700', color: '#94a3b8' },
  currencySymbolActive: { color: '#6366f1' },
  currencyCode: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 2 },
  currencyCodeActive: { color: '#6366f1' },
  currencyLabel: { fontSize: 9, color: '#94a3b8', marginTop: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  switchLabel: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  switchDesc: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  signOutBtn: { backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca', marginTop: 8 },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
