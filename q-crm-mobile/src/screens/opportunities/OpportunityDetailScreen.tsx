import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, RefreshControl, Linking, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { api, API_URL, getAuthToken } from '../../lib/api';
import { useCurrency } from '../../contexts/CurrencyContext';

const STEPS = ['Pipeline', 'Presales', 'Sales', 'Project'];
const STAGE_MAP: Record<string, number> = {
  Pipeline: 0, Discovery: 0,
  Qualification: 1, Presales: 1,
  Proposal: 2, Negotiation: 2, Sales: 2,
  'Closed Won': 3, Delivered: 3, Project: 3,
  'Closed Lost': 2, 'Proposal Lost': 2,
};
const STAGE_COLORS: Record<string, string> = {
  Pipeline: '#6366f1', Discovery: '#6366f1', Qualification: '#f59e0b',
  Proposal: '#8b5cf6', Negotiation: '#f97316',
  'Closed Won': '#10b981', 'Closed Lost': '#ef4444', 'Proposal Lost': '#e11d48',
};
const DURATION_UNITS = ['days', 'weeks', 'months'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function calculateDailyCost(annualCtc: number, assumptions: any): number {
  const dm = annualCtc * ((assumptions.deliveryMgmtPercent || 5) / 100);
  const bench = annualCtc * ((assumptions.benchPercent || 10) / 100);
  const leave = annualCtc * ((assumptions.leaveEligibilityPercent || 0) / 100);
  const growth = annualCtc * ((assumptions.annualGrowthBufferPercent || 0) / 100);
  const increment = annualCtc * ((assumptions.averageIncrementPercent || 0) / 100);
  const total = annualCtc + dm + bench + leave + growth + increment;
  return total / (assumptions.workingDaysPerYear || 240);
}

function getVisibleMonths(startDate: string | undefined, endDate: string | undefined, year: number): string[] {
  if (!startDate) return MONTH_NAMES;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(year, i, 1);
    const monthEnd = new Date(year, i + 1, 0);
    if (monthStart <= end && monthEnd >= start) {
      months.push(MONTH_NAMES[i]);
    }
  }
  return months.length > 0 ? months : MONTH_NAMES;
}

function getClientName(opp: any): string {
  if (!opp) return '';
  if (opp.client && typeof opp.client === 'object') return opp.client.name || '';
  if (typeof opp.client === 'string') return opp.client;
  return opp.clientName || '';
}

export default function OpportunityDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const oppId = route.params?.id;
  const { formatCompact: fmt } = useCurrency();

  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [presalesModalVisible, setPresalesModalVisible] = useState(false);
  const [lostModalVisible, setLostModalVisible] = useState(false);
  const [lostType, setLostType] = useState<'Closed Lost' | 'Proposal Lost'>('Closed Lost');
  const [reEstimateModalVisible, setReEstimateModalVisible] = useState(false);
  const [rateCardModalVisible, setRateCardModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState('');
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState<any[]>([]);
  const [newClientModalVisible, setNewClientModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Date picker
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerField, setDatePickerField] = useState('');
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  // Modal form data
  const [presalesForm, setPresalesForm] = useState({ managerName: '', proposalDueDate: '', comments: '' });
  const [lostRemarks, setLostRemarks] = useState('');
  const [reEstimateComment, setReEstimateComment] = useState('');
  const [adjustedValue, setAdjustedValue] = useState('');

  // Pipeline editing
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  // Presales editing
  const [resources, setResources] = useState<any[]>([]);
  const [travelCosts, setTravelCosts] = useState<Record<string, any>>({});
  const [markupPercent, setMarkupPercent] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [rateCardSearch, setRateCardSearch] = useState('');
  const [presalesDirty, setPresalesDirty] = useState(false);

  // Schedule editing
  const [scheduleEdit, setScheduleEdit] = useState(false);
  const [schedStartDate, setSchedStartDate] = useState('');
  const [schedDuration, setSchedDuration] = useState('');
  const [schedDurationUnit, setSchedDurationUnit] = useState('months');

  // Main data
  const { data: opp, isLoading, refetch } = useQuery({
    queryKey: ['opportunity', oppId],
    queryFn: () => api.get(`/api/opportunities/${oppId}`),
    enabled: !!oppId,
  });
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['opportunity-comments', oppId],
    queryFn: () => api.get(`/api/opportunities/${oppId}/comments`),
    enabled: !!oppId,
  });
  const { data: auditData } = useQuery({
    queryKey: ['opportunity-audit', oppId],
    queryFn: () => api.get(`/api/opportunities/${oppId}/audit-log`),
    enabled: !!oppId,
  });

  // Master data
  const { data: managers } = useQuery({ queryKey: ['managers'], queryFn: () => api.get('/api/master/managers') });
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/api/master/clients') });
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: () => api.get('/api/master/regions') });
  const { data: technologies } = useQuery({ queryKey: ['technologies'], queryFn: () => api.get('/api/master/technologies') });
  const { data: projectTypes } = useQuery({ queryKey: ['projectTypes'], queryFn: () => api.get('/api/master/project-types') });
  const { data: pricingModels } = useQuery({ queryKey: ['pricingModels'], queryFn: () => api.get('/api/master/pricing-models') });
  const { data: salespersons } = useQuery({ queryKey: ['salespersons'], queryFn: () => api.get('/api/master/salespersons') });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/api/master/departments') });
  const { data: rateCards } = useQuery({ queryKey: ['rateCards'], queryFn: () => api.get('/api/rate-cards'), enabled: activeStep === 1 });
  const { data: budgetAssumptions } = useQuery({
    queryKey: ['budgetAssumptions'],
    queryFn: () => api.get('/api/admin/budget-assumptions'),
    enabled: activeStep === 1,
  });

  // Mutations
  const updateMut = useMutation({
    mutationFn: (body: any) => api.patch(`/api/opportunities/${oppId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', oppId] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
  const gomApproveMut = useMutation({
    mutationFn: (approved: boolean) => api.patch(`/api/opportunities/${oppId}/approve-gom`, { approved }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opportunity', oppId] }); },
  });
  const addCommentMut = useMutation({
    mutationFn: (content: string) => api.post(`/api/opportunities/${oppId}/comments`, { content, stage: opp?.currentStage }),
    onSuccess: () => refetchComments(),
  });
  const deleteAttachmentMut = useMutation({
    mutationFn: (attId: string) => api.delete(`/api/opportunities/${oppId}/attachments/${attId}`),
    onSuccess: () => refetch(),
  });
  const createClientMut = useMutation({
    mutationFn: (body: { name: string }) => api.post('/api/master/clients', body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setEditFields(f => ({ ...f, clientId: data.id, clientName: data.name }));
      setNewClientModalVisible(false);
      setNewClientName('');
      setPickerVisible(false);
      Alert.alert('Success', `Client "${data.name}" created`);
    },
    onError: (e: any) => Alert.alert('Error', e.message || 'Failed to create client'),
  });

  const currentStageName = opp?.currentStage || opp?.stage?.name || 'Pipeline';
  const oppStageStep = STAGE_MAP[currentStageName] ?? 0;
  const isLost = currentStageName === 'Closed Lost' || currentStageName === 'Proposal Lost';
  const hasProject = !!opp?.project;
  const canEditPresales = oppStageStep === 1 && !isLost;
  const canEditPipeline = oppStageStep === 0 && !isLost;
  const canUploadAttachments = (oppStageStep <= 1) && !isLost;  // Allow uploads in Pipeline and Presales

  useEffect(() => {
    if (opp) {
      setActiveStep(hasProject ? 3 : oppStageStep);
      const pd = opp.presalesData || {};
      setResources(pd.resources || []);
      setTravelCosts(pd.travelCosts || {});
      setMarkupPercent(pd.markupPercent || 0);
      setSelectedYear(pd.selectedYear || new Date().getFullYear());
      setPresalesDirty(false);
      setSchedStartDate(opp.tentativeStartDate ? opp.tentativeStartDate.split('T')[0] : '');
      setSchedDuration(opp.tentativeDuration ? String(opp.tentativeDuration) : '');
      setSchedDurationUnit(opp.tentativeDurationUnit || 'months');
    }
  }, [opp, oppStageStep, hasProject]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchComments()]);
    setRefreshing(false);
  }, [refetch, refetchComments]);

  const [newComment, setNewComment] = useState('');
  const comments = commentsData?.data || commentsData || [];
  const auditLog = auditData?.data || auditData || [];

  // GOM calculations
  const resourceRevenue = useMemo(() => resources.reduce((s: number, r: any) => {
    const totalDays = Object.values(r.monthlyEfforts || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    return s + (Number(r.dailyRate) || 0) * (totalDays as number);
  }, 0), [resources]);
  const totalCost = useMemo(() => resources.reduce((s: number, r: any) => {
    const totalDays = Object.values(r.monthlyEfforts || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    return s + (Number(r.dailyCost) || 0) * (totalDays as number);
  }, 0), [resources]);
  const travelTotal = useMemo(() => {
    let sum = 0;
    ['roundTripCost', 'medicalInsurance', 'medicalInsuranceCost', 'visaCost', 'vaccineCost', 'hotelCost'].forEach(k => {
      sum += Number(travelCosts[k]) || 0;
    });
    return sum;
  }, [travelCosts]);
  const finalCost = totalCost + travelTotal;
  // Use adjustedEstimatedValue as revenue override (matching web UI logic)
  const adjVal = Number(opp?.adjustedEstimatedValue) || 0;
  const totalRevenue = adjVal > 0 ? adjVal : resourceRevenue;
  const gomPercent = totalRevenue > 0 ? ((totalRevenue - finalCost) / totalRevenue * 100) : 0;

  const calcEndDate = useMemo(() => {
    if (!schedStartDate || !schedDuration) return '';
    try {
      const start = new Date(schedStartDate);
      const dur = parseInt(schedDuration);
      if (isNaN(dur)) return '';
      const end = new Date(start);
      if (schedDurationUnit === 'months') end.setMonth(end.getMonth() + dur);
      else if (schedDurationUnit === 'weeks') end.setDate(end.getDate() + dur * 7);
      else end.setDate(end.getDate() + dur);
      return toISODate(end);
    } catch { return ''; }
  }, [schedStartDate, schedDuration, schedDurationUnit]);

  const visibleMonths = useMemo(() =>
    getVisibleMonths(opp?.tentativeStartDate, opp?.tentativeEndDate, selectedYear),
    [opp?.tentativeStartDate, opp?.tentativeEndDate, selectedYear]
  );

  const filteredRateCards = useMemo(() => {
    if (!rateCards) return [];
    const arr = Array.isArray(rateCards) ? rateCards : [];
    if (!rateCardSearch.trim()) return arr.slice(0, 50);
    const q = rateCardSearch.toLowerCase();
    return arr.filter((rc: any) =>
      (rc.role || '').toLowerCase().includes(q) ||
      (rc.code || '').toLowerCase().includes(q) ||
      (rc.skill || '').toLowerCase().includes(q) ||
      (rc.experienceBand || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [rateCards, rateCardSearch]);

  // === HANDLERS ===
  const handleMoveToPresales = () => {
    if (!presalesForm.managerName || !presalesForm.comments) {
      Alert.alert('Required', 'Please fill Manager and Comment'); return;
    }
    updateMut.mutate({
      stageName: 'Qualification',
      managerName: presalesForm.managerName,
      presalesData: { ...opp?.presalesData, ...presalesForm },
    }, { onSuccess: () => Alert.alert('Success', 'Moved to Presales'), onError: (e: any) => Alert.alert('Error', e.message) });
    setPresalesModalVisible(false);
    setPresalesForm({ managerName: '', proposalDueDate: '', comments: '' });
  };

  const handleMoveToSales = () => {
    if (!opp?.gomApproved) { Alert.alert('GOM Required', 'GOM must be approved before moving to Sales'); return; }
    updateMut.mutate({ stageName: 'Proposal' }, { onSuccess: () => Alert.alert('Success', 'Moved to Sales'), onError: (e: any) => Alert.alert('Error', e.message) });
  };

  const handleProposalSent = () => {
    updateMut.mutate({ stageName: 'Negotiation' }, { onSuccess: () => Alert.alert('Success', 'Moved to Negotiation'), onError: (e: any) => Alert.alert('Error', e.message) });
  };

  const handleMarkLost = () => {
    if (!lostRemarks.trim()) { Alert.alert('Required', 'Enter reason for loss'); return; }
    updateMut.mutate({ stageName: lostType, salesData: { ...opp?.salesData, lostRemarks } });
    setLostModalVisible(false); setLostRemarks('');
  };

  const handleReEstimate = () => {
    if (!reEstimateComment.trim()) { Alert.alert('Required', 'Enter re-estimation comment'); return; }
    const body: any = { stageName: 'Qualification', reEstimateComment };
    if (adjustedValue) body.adjustedEstimatedValue = Number(adjustedValue);
    updateMut.mutate(body, { onSuccess: () => Alert.alert('Success', 'Sent back for re-estimation'), onError: (e: any) => Alert.alert('Error', e.message) });
    setReEstimateModalVisible(false); setReEstimateComment(''); setAdjustedValue('');
  };

  const handleMoveToProject = () => {
    Alert.alert('Convert to Project', 'This will create a project and mark as Closed Won.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', onPress: () => api.post(`/api/opportunities/${oppId}/convert`, {}).then(() => {
        qc.invalidateQueries({ queryKey: ['opportunity', oppId] });
        qc.invalidateQueries({ queryKey: ['opportunities'] });
        Alert.alert('Success', 'Converted to Project');
      }).catch(e => Alert.alert('Error', e.message)) },
    ]);
  };

  const handleSave = () => {
    updateMut.mutate(editFields, {
      onSuccess: () => { setEditMode(false); setEditFields({}); Alert.alert('Saved', 'Opportunity updated'); },
      onError: (e: any) => Alert.alert('Error', e.message),
    });
  };

  const handleSaveEstimation = () => {
    updateMut.mutate({
      presalesData: { resources, travelCosts, markupPercent, currency: 'INR', selectedYear },
    }, {
      onSuccess: () => { setPresalesDirty(false); Alert.alert('Saved', 'Estimation saved'); },
      onError: (e: any) => Alert.alert('Error', e.message),
    });
  };

  const handleSaveSchedule = () => {
    updateMut.mutate({
      tentativeStartDate: schedStartDate,
      tentativeDuration: schedDuration ? Number(schedDuration) : undefined,
      tentativeDurationUnit: schedDurationUnit,
      tentativeEndDate: calcEndDate || undefined,
    }, {
      onSuccess: () => { setScheduleEdit(false); Alert.alert('Saved', 'Schedule updated'); },
      onError: (e: any) => Alert.alert('Error', e.message),
    });
  };

  const handleApproveGom = () => gomApproveMut.mutate(true, {
    onSuccess: () => Alert.alert('Success', 'GOM Approved'), onError: (e: any) => Alert.alert('Error', e.message),
  });
  const handleRevokeGom = () => gomApproveMut.mutate(false, {
    onSuccess: () => Alert.alert('Success', 'GOM Revoked'), onError: (e: any) => Alert.alert('Error', e.message),
  });

  const handleAddComment = () => { if (!newComment.trim()) return; addCommentMut.mutate(newComment.trim()); setNewComment(''); };
  const handleDownloadAttachment = (att: any) => { Linking.openURL(`${API_URL}/api/opportunities/${oppId}/attachments/${att.id}/download`); };
  const handleDeleteAttachment = (att: any) => {
    Alert.alert('Delete', `Delete "${att.fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAttachmentMut.mutate(att.id) },
    ]);
  };

  const [uploading, setUploading] = useState(false);
  const handleUploadAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const file = result.assets[0];
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);
      
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/opportunities/${oppId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      await refetch();
      Alert.alert('Success', `File "${file.name}" uploaded`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleAddResource = (rc: any) => {
    const assumptions = budgetAssumptions || {};
    const dailyCost = calculateDailyCost(rc.ctc, assumptions);
    const dailyRate = dailyCost * (1 + (markupPercent / 100));
    setResources(prev => [...prev, {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: rc.role + (rc.experienceBand ? ` (${rc.experienceBand})` : ''),
      baseLocation: 'India', deliveryFrom: 'Hyderabad', type: 'Offshore',
      annualCTC: rc.ctc,
      dailyCost: Math.round(dailyCost * 100) / 100,
      dailyRate: Math.round(dailyRate * 100) / 100,
      monthlyEfforts: {},
    }]);
    setPresalesDirty(true); setRateCardModalVisible(false); setRateCardSearch('');
  };

  const handleRemoveResource = (index: number) => {
    Alert.alert('Remove Resource', 'Remove this resource?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { setResources(prev => prev.filter((_, i) => i !== index)); setPresalesDirty(true); } },
    ]);
  };

  const handleToggleResourceType = (index: number) => {
    setResources(prev => prev.map((r, i) => i === index ? { ...r, type: r.type === 'Onsite' ? 'Offshore' : 'Onsite' } : r));
    setPresalesDirty(true);
  };

  const handleUpdateEffort = (resIndex: number, month: string, days: string) => {
    const numDays = Number(days) || 0;
    setResources(prev => prev.map((r, i) => {
      if (i !== resIndex) return r;
      const efforts = { ...(r.monthlyEfforts || {}) };
      if (numDays > 0) efforts[month] = numDays; else delete efforts[month];
      return { ...r, monthlyEfforts: efforts };
    }));
    setPresalesDirty(true);
  };

  const handleMarkupChange = (newMarkup: string) => {
    const mk = Number(newMarkup) || 0;
    setMarkupPercent(mk);
    setResources(prev => prev.map(r => ({ ...r, dailyRate: Math.round(r.dailyCost * (1 + mk / 100) * 100) / 100 })));
    setPresalesDirty(true);
  };

  const handleTravelCostChange = (field: string, value: string) => {
    setTravelCosts(prev => ({ ...prev, [field]: field === 'modeOfTravel' || field === 'frequency' ? value : (Number(value) || 0) }));
    setPresalesDirty(true);
  };

  const openDatePicker = (field: string, currentValue?: string) => {
    setDatePickerField(field);
    setDatePickerValue(currentValue ? new Date(currentValue) : new Date());
    setDatePickerVisible(true);
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setDatePickerVisible(Platform.OS === 'ios');
    if (!selectedDate) return;
    const iso = toISODate(selectedDate);
    if (datePickerField === 'presalesProposalDueDate') setPresalesForm(p => ({ ...p, proposalDueDate: iso }));
    else if (datePickerField === 'schedStartDate') setSchedStartDate(iso);
    else if (datePickerField === 'editStartDate') setEditFields(f => ({ ...f, tentativeStartDate: iso }));
  };

  const openPicker = (field: string, title: string, options: any[]) => {
    setPickerField(field); setPickerTitle(title); setPickerOptions(options); setPickerVisible(true);
  };
  const handlePickerSelect = (item: any) => {
    const name = item.name || item;
    if (pickerField === 'clientId') setEditFields(f => ({ ...f, clientId: item.id, clientName: item.name }));
    else setEditFields(f => ({ ...f, [pickerField]: name }));
    setPickerVisible(false);
  };

  if (isLoading) return <View style={st.loadWrap}><ActivityIndicator size="large" color="#6366f1" /></View>;
  if (!opp) return <View style={st.loadWrap}><Text>Opportunity not found</Text></View>;

  const presalesData = opp.presalesData || {};
  const salesData = opp.salesData || {};
  const attachments = opp.attachments || [];

  return (
    <SafeAreaView style={st.container}>
      <View style={st.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} style={st.backBtn}>
          <Text style={st.backText}>← Back</Text>
        </TouchableOpacity>
        {isLost && <View style={[st.lostBadge, { backgroundColor: currentStageName === 'Proposal Lost' ? '#e11d48' : '#ef4444' }]}><Text style={st.lostBadgeText}>{currentStageName}</Text></View>}
        {opp.gomApproved && <View style={st.gomBadge}><Text style={st.gomBadgeText}>GOM ✓</Text></View>}
      </View>

      <View style={st.titleWrap}>
        <Text style={st.name} numberOfLines={2}>{opp.name || opp.title}</Text>
        <Text style={st.client}>{getClientName(opp)} • {fmt(opp.value)}</Text>
      </View>

      <View style={st.stepper}>
        {STEPS.map((s, i) => {
          const isActive = activeStep === i;
          const isComplete = oppStageStep > i || hasProject;
          const isDisabled = isLost && i > oppStageStep;
          return (
            <TouchableOpacity key={s} style={[st.step, isDisabled && st.stepDisabled]}
              onPress={() => !isDisabled && setActiveStep(i)} disabled={isDisabled}>
              <View style={[st.stepDot, isActive && st.stepDotActive, isComplete && st.stepDotComplete]}>
                <Text style={[st.stepDotText, (isActive || isComplete) && { color: '#fff' }]}>{isComplete ? '✓' : i + 1}</Text>
              </View>
              <Text style={[st.stepLabel, isActive && st.stepLabelActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* === PIPELINE === */}
        {activeStep === 0 && (
          <View style={st.section}>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>Pipeline Details</Text>
              {oppStageStep === 0 && !isLost && (
                <TouchableOpacity onPress={() => { if (editMode) { setEditMode(false); setEditFields({}); } else { setEditMode(true); setEditFields({}); } }}>
                  <Text style={st.editToggle}>{editMode ? 'Cancel' : 'Edit'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!editMode ? (
              <>
                <FieldRow label="Client" value={getClientName(opp)} />
                <FieldRow label="Region" value={opp.region} />
                <FieldRow label="Project Type" value={opp.projectType} />
                <FieldRow label="Project Name" value={opp.name || opp.title} />
                <FieldRow label="Practice" value={opp.practice} />
                <FieldRow label="Sales Rep" value={opp.salesRepName || opp.owner} />
                <FieldRow label="Technology" value={opp.technology} />
                <FieldRow label="Pricing Model" value={opp.pricingModel} />
                {opp.projectType === 'Staffing' && <FieldRow label="Expected Day Rate" value={opp.expectedDayRate ? `$${Number(opp.expectedDayRate).toFixed(0)}` : '-'} />}
                <FieldRow label="Estimated Value" value={fmt(opp.value)} />
                {opp.adjustedEstimatedValue > 0 && <FieldRow label="Adjusted Value" value={fmt(opp.adjustedEstimatedValue)} />}
                <FieldRow label="Start Date" value={fmtDate(opp.tentativeStartDate)} />
                <FieldRow label="Duration" value={opp.tentativeDuration ? `${opp.tentativeDuration} ${opp.tentativeDurationUnit || 'months'}` : '-'} />
                <FieldRow label="End Date" value={fmtDate(opp.tentativeEndDate)} />
                <FieldRow label="Description" value={opp.description || '-'} />
                <FieldRow label="Re-estimates" value={String(opp.reEstimateCount || 0)} />
                <FieldRow label="Stage" value={currentStageName} highlight />
              </>
            ) : (
              <>
                <EditPickerField label="Client *" value={editFields.clientName || getClientName(opp)} onPress={() => openPicker('clientId', 'Select Client', clients || [])} />
                <EditPickerField label="Region *" value={editFields.region || opp.region || ''} onPress={() => openPicker('region', 'Select Region', regions || [])} />
                <EditPickerField label="Project Type *" value={editFields.projectType || opp.projectType || ''} onPress={() => openPicker('projectType', 'Select Project Type', projectTypes || [])} />
                <EditInputField label="Project Name *" value={editFields.title ?? (opp.name || opp.title || '')} onChangeText={(v: string) => setEditFields(f => ({ ...f, title: v }))} />
                <EditPickerField label="Practice" value={editFields.practice || opp.practice || ''} onPress={() => openPicker('practice', 'Select Practice', departments || [])} />
                <EditPickerField label="Sales Rep *" value={editFields.salesRepName || opp.salesRepName || opp.owner || ''} onPress={() => openPicker('salesRepName', 'Select Sales Rep', salespersons || [])} />
                <EditPickerField label="Pricing Model" value={editFields.pricingModel || opp.pricingModel || ''} onPress={() => openPicker('pricingModel', 'Select Pricing Model', pricingModels || [])} />
                {(editFields.projectType || opp.projectType) === 'Staffing' && <EditInputField label="Expected Day Rate ($)" value={String(editFields.expectedDayRate ?? opp.expectedDayRate ?? '')} onChangeText={(v: string) => setEditFields(f => ({ ...f, expectedDayRate: Number(v) || 0 }))} keyboardType="numeric" />}
                <EditInputField label="Estimated Value ($)" value={String(editFields.value ?? opp.value ?? '')} onChangeText={(v: string) => setEditFields(f => ({ ...f, value: Number(v) || 0 }))} keyboardType="numeric" />

                <Text style={st.editLabel}>Start Date *</Text>
                <TouchableOpacity style={st.datePickerBtn} onPress={() => openDatePicker('editStartDate', editFields.tentativeStartDate || opp.tentativeStartDate)}>
                  <Text style={st.datePickerText}>{editFields.tentativeStartDate || (opp.tentativeStartDate ? opp.tentativeStartDate.split('T')[0] : 'Select date')}</Text>
                  <Text style={st.calIcon}>📅</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <EditInputField label="Duration" value={String(editFields.tentativeDuration ?? opp.tentativeDuration ?? '')} onChangeText={(v: string) => setEditFields(f => ({ ...f, tentativeDuration: Number(v) || 0 }))} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.editLabel}>Unit</Text>
                    <View style={st.unitRow}>
                      {DURATION_UNITS.map(u => (
                        <TouchableOpacity key={u} style={[st.unitBtn, (editFields.tentativeDurationUnit || opp.tentativeDurationUnit || 'months') === u && st.unitBtnActive]}
                          onPress={() => setEditFields(f => ({ ...f, tentativeDurationUnit: u }))}>
                          <Text style={[st.unitText, (editFields.tentativeDurationUnit || opp.tentativeDurationUnit || 'months') === u && st.unitTextActive]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <EditInputField label="Description" value={editFields.description ?? opp.description ?? ''} onChangeText={(v: string) => setEditFields(f => ({ ...f, description: v }))} multiline />
              </>
            )}

            {/* Attachments in Pipeline */}
            <View style={st.divider} />
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>Attachments ({attachments.length})</Text>
              {canUploadAttachments && (
                <TouchableOpacity onPress={handleUploadAttachment} disabled={uploading} style={st.uploadBtn}>
                  <Text style={st.uploadBtnText}>{uploading ? '⏳' : '📎'} {uploading ? 'Uploading...' : 'Add File'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {attachments.length === 0 ? <Text style={st.emptyText}>No attachments</Text> : attachments.map((att: any) => (
              <View key={att.id} style={st.attachRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.attachName}>{att.fileName}</Text>
                  <Text style={st.attachMeta}>{att.fileType} • {(att.fileSize / 1024).toFixed(0)}KB • {fmtDate(att.uploadedAt)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDownloadAttachment(att)} style={st.attachBtn}><Text style={st.attachBtnText}>⬇</Text></TouchableOpacity>
                {canUploadAttachments && <TouchableOpacity onPress={() => handleDeleteAttachment(att)} style={[st.attachBtn, { backgroundColor: '#fef2f2' }]}><Text style={[st.attachBtnText, { color: '#ef4444' }]}>🗑</Text></TouchableOpacity>}
              </View>
            ))}

            {oppStageStep === 0 && !isLost && (
              <View style={st.actionRow}>
                {editMode && <ActionBtn label="Save" color="#6366f1" onPress={handleSave} loading={updateMut.isPending} />}
                <ActionBtn label="Move to Presales" color="#f59e0b" onPress={() => setPresalesModalVisible(true)} />
              </View>
            )}
          </View>
        )}

        {/* === PRESALES === */}
        {activeStep === 1 && (
          <View style={st.section}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabScroll}>
              {['Project Details', 'Schedule', 'Resources', 'GOM', 'Estimation'].map((t, i) => (
                <TouchableOpacity key={t} style={[st.tab, activeTab === i && st.tabActive]} onPress={() => setActiveTab(i)}>
                  <Text style={[st.tabText, activeTab === i && st.tabTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tab: Project Details */}
            {activeTab === 0 && (
              <View>
                <Text style={st.sectionTitle}>Project Details</Text>
                <FieldRow label="Client" value={getClientName(opp)} />
                <FieldRow label="Project Name" value={opp.name || opp.title} />
                <FieldRow label="Type" value={opp.projectType} />
                <FieldRow label="Region" value={opp.region} />
                <FieldRow label="Practice" value={opp.practice} />
                <FieldRow label="Proposal Due Date" value={fmtDate(presalesData.proposalDueDate)} />
                <FieldRow label="Sales Rep" value={opp.salesRepName || opp.owner} />
                <FieldRow label="Manager" value={opp.managerName || presalesData.managerName} />
                <FieldRow label="Pricing Model" value={opp.pricingModel} />
                {opp.projectType === 'Staffing' && <FieldRow label="Expected Day Rate" value={opp.expectedDayRate ? `$${Number(opp.expectedDayRate).toFixed(0)}` : '-'} />}
                {opp.adjustedEstimatedValue > 0 && <FieldRow label="Adjusted Value" value={fmt(opp.adjustedEstimatedValue)} />}
                <FieldRow label="Description" value={opp.description || '-'} />

                <View style={st.divider} />
                <Text style={st.sectionTitle}>Resource & Cost</Text>
                <FieldRow label="GOM %" value={`${gomPercent.toFixed(1)}%`} highlight />
                <FieldRow label="GOM Status" value={opp.gomApproved ? '✅ Approved' : '⏳ Pending'} highlight />
                <FieldRow label="Revenue" value={fmt(totalRevenue)} />
                <FieldRow label="Final Cost" value={fmt(finalCost)} />
                {canEditPresales ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={[st.fieldLabel, { flex: 1 }]}>Markup %</Text>
                    <TextInput style={[st.inlineInput, { width: 80 }]} value={String(markupPercent)} onChangeText={handleMarkupChange} keyboardType="numeric" />
                  </View>
                ) : <FieldRow label="Markup %" value={`${markupPercent}%`} />}

                <View style={st.divider} />
                <Text style={st.sectionTitle}>Travel & Hospitality</Text>
                {canEditPresales ? (
                  <>
                    <EditPickerField label="Mode of Travel" value={travelCosts.modeOfTravel || 'Select'}
                      onPress={() => { setPickerField('travelMode'); setPickerTitle('Mode of Travel'); setPickerOptions([{ name: 'Flight' }, { name: 'Train' }]); setPickerVisible(true); }} />
                    <EditInputField label="Frequency" value={travelCosts.frequency || ''} onChangeText={(v: string) => handleTravelCostChange('frequency', v)} placeholder="e.g. Monthly" />
                    <EditInputField label="Round Trip Cost" value={String(travelCosts.roundTripCost || '')} onChangeText={(v: string) => handleTravelCostChange('roundTripCost', v)} keyboardType="numeric" />
                    <EditInputField label="Medical Insurance" value={String(travelCosts.medicalInsurance || '')} onChangeText={(v: string) => handleTravelCostChange('medicalInsurance', v)} keyboardType="numeric" />
                    <EditInputField label="Visa Cost" value={String(travelCosts.visaCost || '')} onChangeText={(v: string) => handleTravelCostChange('visaCost', v)} keyboardType="numeric" />
                    <EditInputField label="Vaccine Cost" value={String(travelCosts.vaccineCost || '')} onChangeText={(v: string) => handleTravelCostChange('vaccineCost', v)} keyboardType="numeric" />
                    <EditInputField label="Hotel Cost" value={String(travelCosts.hotelCost || '')} onChangeText={(v: string) => handleTravelCostChange('hotelCost', v)} keyboardType="numeric" />
                  </>
                ) : (
                  <>
                    <FieldRow label="Mode of Travel" value={travelCosts.modeOfTravel || '-'} />
                    <FieldRow label="Frequency" value={travelCosts.frequency || '-'} />
                    <FieldRow label="Round Trip Cost" value={fmt(travelCosts.roundTripCost)} />
                    <FieldRow label="Medical Insurance" value={fmt(travelCosts.medicalInsurance)} />
                    <FieldRow label="Visa Cost" value={fmt(travelCosts.visaCost)} />
                    <FieldRow label="Vaccine Cost" value={fmt(travelCosts.vaccineCost)} />
                    <FieldRow label="Hotel Cost" value={fmt(travelCosts.hotelCost)} />
                  </>
                )}
                <FieldRow label="Total T&H" value={fmt(travelTotal)} highlight />

                <View style={st.divider} />
                <View style={st.sectionHeader}>
                  <Text style={st.sectionTitle}>Attachments ({attachments.length})</Text>
                  {canUploadAttachments && (
                    <TouchableOpacity onPress={handleUploadAttachment} disabled={uploading} style={st.uploadBtn}>
                      <Text style={st.uploadBtnText}>{uploading ? '⏳' : '📎'} {uploading ? 'Uploading...' : 'Add File'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {attachments.length === 0 ? <Text style={st.emptyText}>No attachments</Text> : attachments.map((att: any) => (
                  <View key={att.id} style={st.attachRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.attachName}>{att.fileName}</Text>
                      <Text style={st.attachMeta}>{att.fileType} • {(att.fileSize / 1024).toFixed(0)}KB • {fmtDate(att.uploadedAt)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDownloadAttachment(att)} style={st.attachBtn}><Text style={st.attachBtnText}>⬇</Text></TouchableOpacity>
                    {canUploadAttachments && <TouchableOpacity onPress={() => handleDeleteAttachment(att)} style={[st.attachBtn, { backgroundColor: '#fef2f2' }]}><Text style={[st.attachBtnText, { color: '#ef4444' }]}>🗑</Text></TouchableOpacity>}
                  </View>
                ))}

                {canEditPresales && (
                  <View style={[st.actionRow, { marginTop: 12 }]}>
                    {!opp.gomApproved ? <ActionBtn label="Approve GOM" color="#10b981" onPress={handleApproveGom} loading={gomApproveMut.isPending} />
                      : <ActionBtn label="Revoke GOM" color="#ef4444" onPress={handleRevokeGom} loading={gomApproveMut.isPending} />}
                  </View>
                )}
              </View>
            )}

            {/* Tab: Schedule */}
            {activeTab === 1 && (
              <View>
                <View style={st.sectionHeader}>
                  <Text style={st.sectionTitle}>Schedule</Text>
                  {canEditPresales && <TouchableOpacity onPress={() => setScheduleEdit(!scheduleEdit)}><Text style={st.editToggle}>{scheduleEdit ? 'Cancel' : 'Edit'}</Text></TouchableOpacity>}
                </View>
                {!scheduleEdit ? (
                  <>
                    <FieldRow label="Tentative Start Date" value={fmtDate(opp.tentativeStartDate)} />
                    <FieldRow label="Duration" value={opp.tentativeDuration ? `${opp.tentativeDuration} ${opp.tentativeDurationUnit || 'months'}` : '-'} />
                    <FieldRow label="Tentative End Date" value={fmtDate(opp.tentativeEndDate)} />
                    <FieldRow label="Proposal Due Date" value={fmtDate(presalesData.proposalDueDate)} />
                  </>
                ) : (
                  <>
                    <Text style={st.editLabel}>Tentative Start Date</Text>
                    <TouchableOpacity style={st.datePickerBtn} onPress={() => openDatePicker('schedStartDate', schedStartDate)}>
                      <Text style={st.datePickerText}>{schedStartDate || 'Select date'}</Text>
                      <Text style={st.calIcon}>📅</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <EditInputField label="Duration" value={schedDuration} onChangeText={setSchedDuration} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.editLabel}>Unit</Text>
                        <View style={st.unitRow}>
                          {DURATION_UNITS.map(u => (
                            <TouchableOpacity key={u} style={[st.unitBtn, schedDurationUnit === u && st.unitBtnActive]} onPress={() => setSchedDurationUnit(u)}>
                              <Text style={[st.unitText, schedDurationUnit === u && st.unitTextActive]}>{u}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    {calcEndDate ? <View style={st.calcField}><Text style={st.calcLabel}>End Date (calculated)</Text><Text style={st.calcValue}>{calcEndDate}</Text></View> : null}
                    <ActionBtn label="Update Schedule" color="#6366f1" onPress={handleSaveSchedule} loading={updateMut.isPending} />
                  </>
                )}
              </View>
            )}

            {/* Tab: Resources */}
            {activeTab === 2 && (
              <View>
                <View style={st.sectionHeader}>
                  <Text style={st.sectionTitle}>Resources ({resources.length})</Text>
                  {canEditPresales && <TouchableOpacity style={st.addResBtn} onPress={() => { setRateCardSearch(''); setRateCardModalVisible(true); }}>
                    <Text style={st.addResBtnText}>+ Add Resource</Text>
                  </TouchableOpacity>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <Text style={st.fieldLabel}>Year:</Text>
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                    <TouchableOpacity key={y} style={[st.yearBtn, selectedYear === y && st.yearBtnActive]} onPress={() => { setSelectedYear(y); setPresalesDirty(true); }}>
                      <Text style={[st.yearBtnText, selectedYear === y && st.yearBtnTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {resources.length === 0 && <Text style={st.emptyText}>No resources assigned. Tap '+ Add Resource' to add from rate cards.</Text>}
                {resources.map((r: any, resIdx: number) => (
                  <View key={r.id || resIdx} style={st.resourceCard}>
                    <View style={st.resourceHeader}>
                      <Text style={st.resourceRole} numberOfLines={1}>{r.role || 'Unnamed'}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity style={[st.typeBadge, r.type === 'Onsite' ? st.onsiteBadge : st.offshoreBadge]}
                          onPress={() => canEditPresales && handleToggleResourceType(resIdx)}>
                          <Text style={st.typeBadgeText}>{r.type || 'Offshore'}</Text>
                        </TouchableOpacity>
                        {canEditPresales && <TouchableOpacity onPress={() => handleRemoveResource(resIdx)}><Text style={{ color: '#ef4444', fontSize: 16 }}>✕</Text></TouchableOpacity>}
                      </View>
                    </View>
                    <View style={st.resourceMeta}>
                      <FieldRowSmall label="Location" value={r.baseLocation || 'India'} />
                      <FieldRowSmall label="Delivery" value={r.deliveryFrom || 'Hyderabad'} />
                      <FieldRowSmall label="Annual CTC" value={r.annualCTC ? `₹${Number(r.annualCTC).toLocaleString()}` : '-'} />
                      <FieldRowSmall label="Cost/day" value={r.dailyCost ? `₹${Number(r.dailyCost).toFixed(0)}` : '-'} />
                      <FieldRowSmall label="Rate/day" value={r.dailyRate ? `₹${Number(r.dailyRate).toFixed(0)}` : '-'} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 8, marginBottom: 4 }}>Monthly Efforts (days):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {visibleMonths.map(m => (
                          <View key={m} style={st.effortCol}>
                            <Text style={st.effortMonth}>{m}</Text>
                            {canEditPresales ? (
                              <TextInput style={st.effortInput} value={String(r.monthlyEfforts?.[m] || '')}
                                onChangeText={v => handleUpdateEffort(resIdx, m, v)} keyboardType="numeric" placeholder="0" placeholderTextColor="#ccc" />
                            ) : <Text style={st.effortDays}>{r.monthlyEfforts?.[m] || 0}</Text>}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ))}
                {canEditPresales && presalesDirty && <ActionBtn label="Save Estimation" color="#6366f1" onPress={handleSaveEstimation} loading={updateMut.isPending} />}
              </View>
            )}

            {/* Tab: GOM */}
            {activeTab === 3 && (
              <View>
                <Text style={st.sectionTitle}>GOM Calculator</Text>
                <View style={st.gomGrid}>
                  <KpiCard label="Total Revenue" value={fmt(totalRevenue)} color="#10b981" />
                  <KpiCard label="Total Cost" value={fmt(finalCost)} color="#ef4444" />
                  <KpiCard label="GOM %" value={`${gomPercent.toFixed(1)}%`} color={gomPercent >= 25 ? '#10b981' : gomPercent >= 15 ? '#f59e0b' : '#ef4444'} />
                  <KpiCard label="Profit" value={fmt(totalRevenue - finalCost)} color="#6366f1" />
                </View>
                <View style={[st.gomStatusBanner, { backgroundColor: opp.gomApproved ? '#d1fae520' : '#fef3c720', borderColor: opp.gomApproved ? '#10b981' : '#f59e0b' }]}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: opp.gomApproved ? '#10b981' : '#f59e0b' }}>
                    {opp.gomApproved ? '✅ GOM Approved' : '⏳ GOM Pending Approval'}
                  </Text>
                </View>
                <View style={st.divider} />
                {budgetAssumptions && (
                  <>
                    <Text style={st.sectionTitle}>Budget Assumptions</Text>
                    <FieldRow label="Margin %" value={`${budgetAssumptions.marginPercent || 35}%`} />
                    <FieldRow label="Working Days/Year" value={String(budgetAssumptions.workingDaysPerYear || 240)} />
                    <FieldRow label="Delivery Mgmt %" value={`${budgetAssumptions.deliveryMgmtPercent || 5}%`} />
                    <FieldRow label="Bench %" value={`${budgetAssumptions.benchPercent || 10}%`} />
                    <FieldRow label="Leave Eligibility %" value={`${budgetAssumptions.leaveEligibilityPercent || 0}%`} />
                    <FieldRow label="Growth Buffer %" value={`${budgetAssumptions.annualGrowthBufferPercent || 0}%`} />
                    <View style={st.divider} />
                  </>
                )}
                <Text style={st.sectionTitle}>Configuration</Text>
                {canEditPresales ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={[st.fieldLabel, { flex: 1 }]}>Markup %</Text>
                    <TextInput style={[st.inlineInput, { width: 80 }]} value={String(markupPercent)} onChangeText={handleMarkupChange} keyboardType="numeric" />
                  </View>
                ) : <FieldRow label="Markup %" value={`${markupPercent}%`} />}
                <FieldRow label="Resource Cost" value={fmt(totalCost)} />
                <FieldRow label="Travel Cost" value={fmt(travelTotal)} />
                <FieldRow label="Total Cost" value={fmt(finalCost)} />
                <FieldRow label="Revenue" value={fmt(totalRevenue)} />
                <FieldRow label="Resources" value={String(resources.length)} />
                {canEditPresales && (
                  <View style={[st.actionRow, { marginTop: 12 }]}>
                    {!opp.gomApproved ? <ActionBtn label="Approve GOM" color="#10b981" onPress={handleApproveGom} loading={gomApproveMut.isPending} />
                      : <ActionBtn label="Revoke GOM" color="#ef4444" onPress={handleRevokeGom} loading={gomApproveMut.isPending} />}
                  </View>
                )}
                {canEditPresales && presalesDirty && <ActionBtn label="Save Estimation" color="#6366f1" onPress={handleSaveEstimation} loading={updateMut.isPending} />}
              </View>
            )}

            {/* Tab: Estimation */}
            {activeTab === 4 && (
              <View>
                <Text style={st.sectionTitle}>Estimation Summary</Text>
                {resources.length === 0 ? <Text style={st.emptyText}>No resources assigned. Add resources in the Resources tab first.</Text> : (
                  <>
                    <View style={st.quoteCard}>
                      <Text style={st.quoteLabel}>Total Quote Price (Revenue)</Text>
                      <Text style={st.quoteValue}>{fmt(totalRevenue)}</Text>
                    </View>
                    <Text style={[st.sectionTitle, { marginTop: 12 }]}>Billed Resources (FTE)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4 }}>
                          <Text style={{ width: 120, fontSize: 11, fontWeight: '700', color: '#64748b' }}>Role</Text>
                          {visibleMonths.map(m => <Text key={m} style={{ width: 50, fontSize: 10, fontWeight: '600', color: '#94a3b8', textAlign: 'center' }}>{m}</Text>)}
                        </View>
                        {resources.map((r: any, i: number) => (
                          <View key={r.id || i} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ width: 120, fontSize: 11, color: '#0f172a' }} numberOfLines={1}>{r.role}</Text>
                            {visibleMonths.map(m => {
                              const days = r.monthlyEfforts?.[m] || 0;
                              const fte = days / ((budgetAssumptions?.workingDaysPerYear || 240) / 12);
                              return <Text key={m} style={{ width: 50, fontSize: 11, textAlign: 'center', color: '#334155' }}>{fte > 0 ? fte.toFixed(2) : '-'}</Text>;
                            })}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                    <Text style={[st.sectionTitle, { marginTop: 12 }]}>Salary Cost</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4 }}>
                          <Text style={{ width: 120, fontSize: 11, fontWeight: '700', color: '#64748b' }}>Role</Text>
                          {visibleMonths.map(m => <Text key={m} style={{ width: 70, fontSize: 10, fontWeight: '600', color: '#94a3b8', textAlign: 'center' }}>{m}</Text>)}
                        </View>
                        {resources.map((r: any, i: number) => (
                          <View key={r.id || i} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ width: 120, fontSize: 11, color: '#0f172a' }} numberOfLines={1}>{r.role}</Text>
                            {visibleMonths.map(m => {
                              const cost = (r.monthlyEfforts?.[m] || 0) * (r.dailyCost || 0);
                              return <Text key={m} style={{ width: 70, fontSize: 10, textAlign: 'center', color: '#334155' }}>{cost > 0 ? fmt(cost) : '-'}</Text>;
                            })}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                    <Text style={[st.sectionTitle, { marginTop: 12 }]}>GOM Summary</Text>
                    <FieldRow label="Salary Cost" value={fmt(totalCost)} />
                    <FieldRow label="Travel & Stay" value={fmt(travelTotal)} />
                    <FieldRow label="Total Cost" value={fmt(finalCost)} />
                    <FieldRow label="Total Revenue" value={fmt(totalRevenue)} />
                    <FieldRow label="GOM %" value={`${gomPercent.toFixed(1)}%`} highlight />
                  </>
                )}
              </View>
            )}

            {/* Presales stage actions */}
            {canEditPresales && (
              <View style={[st.actionRow, { marginTop: 16 }]}>
                <ActionBtn label="Proposal Lost" color="#e11d48" onPress={() => { setLostType('Proposal Lost'); setLostModalVisible(true); }} />
                <ActionBtn label="Move to Sales" color="#8b5cf6" onPress={handleMoveToSales} />
              </View>
            )}
            {canEditPresales && presalesDirty && (
              <TouchableOpacity style={st.saveFab} onPress={handleSaveEstimation}>
                {updateMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.saveFabText}>Save Estimation</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* === SALES === */}
        {activeStep === 2 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Sales Stage</Text>
            <FieldRow label="Current Sub-Stage" value={currentStageName} highlight />
            {isLost && <View style={st.lostBanner}><Text style={st.lostBannerTitle}>{currentStageName}</Text><Text style={st.lostBannerText}>Reason: {salesData.lostRemarks || 'No reason provided'}</Text></View>}
            <View style={st.summaryCard}>
              <View style={st.summaryRow}><Text style={st.summaryLabel}>Client</Text><Text style={st.summaryValue}>{getClientName(opp)}</Text></View>
              <View style={st.summaryRow}><Text style={st.summaryLabel}>Project</Text><Text style={st.summaryValue}>{opp.name || opp.title}</Text></View>
              <View style={st.summaryRow}><Text style={st.summaryLabel}>Duration</Text><Text style={st.summaryValue}>{opp.tentativeDuration} {opp.tentativeDurationUnit}</Text></View>
              {opp.projectType === 'Staffing' && <View style={st.summaryRow}><Text style={st.summaryLabel}>Day Rate</Text><Text style={st.summaryValue}>${Number(opp.expectedDayRate || 0).toFixed(0)}</Text></View>}
              <View style={st.summaryRow}><Text style={st.summaryLabel}>Value</Text><Text style={st.summaryValue}>{fmt(opp.value)}</Text></View>
              {opp.adjustedEstimatedValue > 0 && <View style={st.summaryRow}><Text style={st.summaryLabel}>Adjusted Value</Text><Text style={st.summaryValue}>{fmt(opp.adjustedEstimatedValue)}</Text></View>}
              <View style={st.summaryRow}><Text style={st.summaryLabel}>GOM %</Text><Text style={st.summaryValue}>{gomPercent.toFixed(1)}%</Text></View>
              <View style={st.summaryRow}><Text style={st.summaryLabel}>GOM Approved</Text><Text style={st.summaryValue}>{opp.gomApproved ? '✅' : '❌'}</Text></View>
              <View style={st.summaryRow}><Text style={st.summaryLabel}>Re-estimates</Text><Text style={st.summaryValue}>{opp.reEstimateCount || 0}</Text></View>
            </View>
            <CollapsibleSection title="Pipeline Details">
              <FieldRow label="Client" value={getClientName(opp)} /><FieldRow label="Region" value={opp.region} /><FieldRow label="Project Type" value={opp.projectType} />
              <FieldRow label="Practice" value={opp.practice} /><FieldRow label="Technology" value={opp.technology} /><FieldRow label="Pricing Model" value={opp.pricingModel} />
              <FieldRow label="Sales Rep" value={opp.salesRepName || opp.owner} /><FieldRow label="Manager" value={opp.managerName} />
              <FieldRow label="Start Date" value={fmtDate(opp.tentativeStartDate)} /><FieldRow label="End Date" value={fmtDate(opp.tentativeEndDate)} />
              <FieldRow label="Description" value={opp.description || '-'} />
            </CollapsibleSection>
            <CollapsibleSection title="Presales / Estimation Details">
              <FieldRow label="Markup %" value={`${markupPercent}%`} /><FieldRow label="Mode of Travel" value={travelCosts.modeOfTravel || '-'} />
              <FieldRow label="Round Trip Cost" value={fmt(travelCosts.roundTripCost)} /><FieldRow label="Medical Insurance" value={fmt(travelCosts.medicalInsurance)} />
              <FieldRow label="Visa Cost" value={fmt(travelCosts.visaCost)} /><FieldRow label="Hotel Cost" value={fmt(travelCosts.hotelCost)} />
              <View style={st.divider} />
              <FieldRow label="Revenue" value={fmt(totalRevenue)} /><FieldRow label="Cost" value={fmt(finalCost)} />
              <FieldRow label="GOM %" value={`${gomPercent.toFixed(1)}%`} highlight /><FieldRow label="Resources" value={String(resources.length)} />
            </CollapsibleSection>
            {!isLost && oppStageStep === 2 && (
              <View style={st.actionColumn}>
                {currentStageName === 'Proposal' && (
                  <>
                    <ActionBtn label="Proposal Lost" color="#e11d48" onPress={() => { setLostType('Proposal Lost'); setLostModalVisible(true); }} />
                    <ActionBtn label="Send Back for Re-estimate" color="#f59e0b" onPress={() => setReEstimateModalVisible(true)} />
                    <ActionBtn label="Proposal Sent" color="#8b5cf6" onPress={handleProposalSent} />
                  </>
                )}
                {currentStageName === 'Negotiation' && (
                  <>
                    <ActionBtn label="Mark as Lost" color="#ef4444" onPress={() => { setLostType('Closed Lost'); setLostModalVisible(true); }} />
                    <ActionBtn label="Send Back for Re-estimate" color="#f59e0b" onPress={() => setReEstimateModalVisible(true)} />
                    <ActionBtn label="Move to Project" color="#10b981" onPress={handleMoveToProject} />
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* === PROJECT === */}
        {activeStep === 3 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Project</Text>
            {opp.project ? (
              <View style={st.projectCard}>
                <FieldRow label="Project Name" value={opp.project.name || opp.name || opp.title} />
                <FieldRow label="Project Code" value={opp.project.code || '-'} />
                <FieldRow label="Client" value={getClientName(opp)} />
                <FieldRow label="Value" value={fmt(opp.value)} />
                <FieldRow label="Status" value="SOW Approved" highlight />
              </View>
            ) : <Text style={st.emptyText}>No project created yet</Text>}
            <TouchableOpacity style={st.backToListBtn} onPress={() => nav.goBack()}><Text style={st.backToListText}>← Back to Opportunities</Text></TouchableOpacity>
          </View>
        )}

        {/* === COMMENTS === */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Comments ({comments.length})</Text>
          <View style={st.commentInput}>
            <TextInput style={st.commentField} placeholder="Add a comment..." value={newComment} onChangeText={setNewComment} placeholderTextColor="#94a3b8" multiline />
            <TouchableOpacity style={st.commentSendBtn} onPress={handleAddComment} disabled={addCommentMut.isPending || !newComment.trim()}>
              <Text style={st.commentSendText}>Send</Text>
            </TouchableOpacity>
          </View>
          {comments.map((c: any) => {
            const stageColor = STAGE_COLORS[c.stage] || '#94a3b8';
            return (
              <View key={c.id} style={st.commentItem}>
                <View style={st.commentHeader}>
                  <Text style={st.commentAuthor}>{c.author?.name || 'Unknown'}</Text>
                  {c.stage && <View style={[st.commentStageBadge, { backgroundColor: stageColor + '20' }]}><Text style={[st.commentStageText, { color: stageColor }]}>{c.stage}</Text></View>}
                </View>
                <Text style={st.commentContent}>{c.content}</Text>
                <Text style={st.commentDate}>{fmtDate(c.createdAt)}</Text>
              </View>
            );
          })}
        </View>

        {/* === AUDIT LOG === */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Audit Log ({auditLog.length})</Text>
          {auditLog.map((e: any) => (
            <View key={e.id} style={st.auditItem}>
              <View style={st.auditDot} />
              <View style={{ flex: 1 }}>
                <Text style={st.auditAction}>{(e.action || '').replace(/_/g, ' ')}</Text>
                <Text style={st.auditUser}>{e.user?.name || 'System'} • {fmtDate(e.timestamp || e.createdAt)}</Text>
                {e.changes && typeof e.changes === 'string' && <Text style={st.auditChanges}>{e.changes}</Text>}
                {e.changes && typeof e.changes === 'object' && <Text style={st.auditChanges}>{JSON.stringify(e.changes, null, 2).substring(0, 200)}</Text>}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* === MODALS === */}
      <Modal visible={presalesModalVisible} transparent animationType="slide">
        <View style={st.modalOverlay}><View style={st.modalContent}>
          <Text style={st.modalTitle}>Move to Presales</Text>
          <Text style={st.editLabel}>Manager *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40, marginBottom: 8 }}>
            {(managers || []).map((m: any, idx: number) => (
              <TouchableOpacity key={m.id || m.name || idx} style={[st.chip, presalesForm.managerName === (m.name || m) && st.chipActive]}
                onPress={() => setPresalesForm(p => ({ ...p, managerName: m.name || m }))}>
                <Text style={[st.chipText, presalesForm.managerName === (m.name || m) && st.chipTextActive]}>{m.name || m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={st.editLabel}>Proposal Due Date *</Text>
          <TouchableOpacity style={st.datePickerBtn} onPress={() => openDatePicker('presalesProposalDueDate', presalesForm.proposalDueDate)}>
            <Text style={st.datePickerText}>{presalesForm.proposalDueDate || 'Select date'}</Text>
            <Text style={st.calIcon}>📅</Text>
          </TouchableOpacity>
          <Text style={st.editLabel}>Comment *</Text>
          <TextInput style={[st.input, { height: 80 }]} placeholder="Add comment..." value={presalesForm.comments}
            onChangeText={t => setPresalesForm(p => ({ ...p, comments: t }))} multiline placeholderTextColor="#94a3b8" />
          <View style={st.modalActions}>
            <TouchableOpacity style={st.modalCancel} onPress={() => setPresalesModalVisible(false)}><Text style={st.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={st.modalConfirm} onPress={handleMoveToPresales}><Text style={st.modalConfirmText}>Move</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={lostModalVisible} transparent animationType="slide">
        <View style={st.modalOverlay}><View style={st.modalContent}>
          <Text style={st.modalTitle}>{lostType === 'Proposal Lost' ? 'Proposal Lost' : 'Mark as Lost'}</Text>
          <Text style={st.editLabel}>Reason / Remarks *</Text>
          <TextInput style={[st.input, { height: 100 }]} placeholder="Enter reason..." value={lostRemarks} onChangeText={setLostRemarks} multiline placeholderTextColor="#94a3b8" />
          <View style={st.modalActions}>
            <TouchableOpacity style={st.modalCancel} onPress={() => { setLostModalVisible(false); setLostRemarks(''); }}><Text style={st.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[st.modalConfirm, { backgroundColor: '#ef4444' }]} onPress={handleMarkLost}><Text style={st.modalConfirmText}>Confirm</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={reEstimateModalVisible} transparent animationType="slide">
        <View style={st.modalOverlay}><View style={st.modalContent}>
          <Text style={st.modalTitle}>Send for Re-estimation</Text>
          <Text style={st.editLabel}>Comment *</Text>
          <TextInput style={[st.input, { height: 80 }]} placeholder="Re-estimation comment..." value={reEstimateComment} onChangeText={setReEstimateComment} multiline placeholderTextColor="#94a3b8" />
          <Text style={st.editLabel}>Adjusted Estimated Value (optional)</Text>
          <TextInput style={st.input} placeholder="0" value={adjustedValue} onChangeText={setAdjustedValue} keyboardType="numeric" placeholderTextColor="#94a3b8" />
          <View style={st.modalActions}>
            <TouchableOpacity style={st.modalCancel} onPress={() => { setReEstimateModalVisible(false); setReEstimateComment(''); setAdjustedValue(''); }}><Text style={st.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[st.modalConfirm, { backgroundColor: '#f59e0b' }]} onPress={handleReEstimate}><Text style={st.modalConfirmText}>Send</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={rateCardModalVisible} transparent animationType="slide">
        <View style={st.modalOverlay}><View style={[st.modalContent, { maxHeight: '85%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={st.modalTitle}>Add Resource</Text>
            <TouchableOpacity onPress={() => setRateCardModalVisible(false)}><Text style={{ fontSize: 22, color: '#94a3b8', padding: 4 }}>✕</Text></TouchableOpacity>
          </View>
          <TextInput style={st.input} placeholder="Search role, code, skill..." value={rateCardSearch} onChangeText={setRateCardSearch} placeholderTextColor="#94a3b8" />
          <FlatList data={filteredRateCards} keyExtractor={(item: any) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={st.rcItem} onPress={() => handleAddResource(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={st.rcRole}>{item.role}{item.experienceBand ? ` (${item.experienceBand})` : ''}</Text>
                  <Text style={st.rcMeta}>{item.skill} • {item.category} • CTC: ₹{Number(item.ctc).toLocaleString()}</Text>
                </View>
                <Text style={st.rcAdd}>+</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={<Text style={st.emptyText}>No rate cards found</Text>}
            style={{ maxHeight: 400 }}
          />
        </View></View>
      </Modal>

      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={st.modalOverlay}><View style={st.modalContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={st.modalTitle}>{pickerTitle}</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}><Text style={{ fontSize: 22, color: '#94a3b8', padding: 4 }}>✕</Text></TouchableOpacity>
          </View>
          <FlatList data={pickerOptions} keyExtractor={(item: any, i: number) => item.id || item.name || String(i)}
            ListHeaderComponent={pickerField === 'clientId' ? (
              <TouchableOpacity style={[st.pickerItem, { backgroundColor: '#f0fdf4' }]} onPress={() => { setNewClientModalVisible(true); }}>
                <Text style={[st.pickerItemText, { color: '#10b981', fontWeight: '700' }]}>+ New Client</Text>
              </TouchableOpacity>
            ) : null}
            renderItem={({ item }) => (
              <TouchableOpacity style={st.pickerItem} onPress={() => {
                if (pickerField === 'travelMode') { handleTravelCostChange('modeOfTravel', item.name || item); setPickerVisible(false); }
                else handlePickerSelect(item);
              }}>
                <Text style={st.pickerItemText}>{item.name || item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={<Text style={st.emptyText}>No options available</Text>}
          />
        </View></View>
      </Modal>

      {/* New Client Modal */}
      <Modal visible={newClientModalVisible} transparent animationType="fade">
        <View style={st.modalOverlay}><View style={st.modalContent}>
          <Text style={st.modalTitle}>Create New Client</Text>
          <Text style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Client Name *</Text>
          <TextInput style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0f172a', marginBottom: 16 }}
            value={newClientName} onChangeText={setNewClientName} placeholder="Enter client name" placeholderTextColor="#94a3b8" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center' }} onPress={() => { setNewClientModalVisible(false); setNewClientName(''); }}>
              <Text style={{ color: '#475569', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#6366f1', alignItems: 'center' }}
              onPress={() => { if (!newClientName.trim()) { Alert.alert('Required', 'Client name is required'); return; } createClientMut.mutate({ name: newClientName.trim() }); }}
              disabled={createClientMut.isPending}>
              {createClientMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Create</Text>}
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {datePickerVisible && (
        <DateTimePicker value={datePickerValue} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'calendar'} onChange={handleDateChange} />
      )}
    </SafeAreaView>
  );
}

// === COMPONENTS ===
function FieldRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (<View style={st.fieldRow}><Text style={st.fieldLabel}>{label}</Text><Text style={[st.fieldValue, highlight && st.fieldHighlight]}>{value || '-'}</Text></View>);
}
function FieldRowSmall({ label, value }: { label: string; value: string }) {
  return (<View style={st.fieldRowSmall}><Text style={st.fieldLabelSmall}>{label}</Text><Text style={st.fieldValueSmall}>{value}</Text></View>);
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (<View style={st.kpiCard}><Text style={st.kpiLabel}>{label}</Text><Text style={[st.kpiValue, { color }]}>{value}</Text></View>);
}
function ActionBtn({ label, color, onPress, loading }: { label: string; color: string; onPress: () => void; loading?: boolean }) {
  return (<TouchableOpacity style={[st.actionBtn, { backgroundColor: color }]} onPress={onPress} disabled={loading}>
    {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.actionBtnText}>{label}</Text>}
  </TouchableOpacity>);
}
function EditInputField({ label, value, onChangeText, placeholder, multiline, keyboardType }: any) {
  return (<View style={{ marginBottom: 10 }}><Text style={st.editLabel}>{label}</Text>
    <TextInput style={[st.input, multiline && { height: 80, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder || ''} placeholderTextColor="#94a3b8" multiline={multiline} keyboardType={keyboardType} />
  </View>);
}
function EditPickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (<View style={{ marginBottom: 10 }}><Text style={st.editLabel}>{label}</Text>
    <TouchableOpacity style={st.pickerTrigger} onPress={onPress}>
      <Text style={st.pickerTriggerText} numberOfLines={1}>{value || 'Select'}</Text><Text style={st.pickerArrow}>▼</Text>
    </TouchableOpacity>
  </View>);
}
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (<View style={st.collapsible}><TouchableOpacity style={st.collapsibleHeader} onPress={() => setOpen(!open)}>
    <Text style={st.collapsibleTitle}>{title}</Text><Text style={st.collapsibleArrow}>{open ? '▲' : '▼'}</Text>
  </TouchableOpacity>{open && <View style={st.collapsibleBody}>{children}</View>}</View>);
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 15, color: '#6366f1', fontWeight: '600' },
  lostBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: 'auto' },
  lostBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  gomBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: '#d1fae5', marginLeft: 8 },
  gomBadgeText: { color: '#10b981', fontSize: 11, fontWeight: '700' },
  titleWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  client: { fontSize: 13, color: '#64748b', marginTop: 2 },
  stepper: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  step: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  stepDisabled: { opacity: 0.3 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepDotActive: { backgroundColor: '#6366f1' },
  stepDotComplete: { backgroundColor: '#10b981' },
  stepDotText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  stepLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  stepLabelActive: { color: '#6366f1', fontWeight: '700' },
  section: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  editToggle: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  fieldLabel: { fontSize: 13, color: '#64748b', flex: 1 },
  fieldValue: { fontSize: 13, color: '#0f172a', fontWeight: '500', flex: 1.2, textAlign: 'right' },
  fieldHighlight: { color: '#6366f1', fontWeight: '700' },
  fieldRowSmall: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  fieldLabelSmall: { fontSize: 11, color: '#94a3b8' },
  fieldValueSmall: { fontSize: 11, color: '#0f172a', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionColumn: { gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flex: 1, minWidth: 120 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tabScroll: { marginBottom: 12, maxHeight: 40 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  emptyText: { color: '#94a3b8', fontSize: 13, paddingVertical: 12, textAlign: 'center' },
  resourceCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  resourceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  resourceRole: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  onsiteBadge: { backgroundColor: '#dbeafe' },
  offshoreBadge: { backgroundColor: '#f0fdf4' },
  typeBadgeText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  resourceMeta: { marginTop: 4 },
  effortCol: { alignItems: 'center', width: 48 },
  effortMonth: { fontSize: 9, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  effortDays: { fontSize: 12, color: '#0f172a', fontWeight: '600' },
  effortInput: { width: 40, height: 30, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, textAlign: 'center', fontSize: 12, color: '#0f172a', backgroundColor: '#fff', paddingVertical: 2 },
  gomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { flex: 1, minWidth: '45%' as any, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, alignItems: 'center' },
  kpiLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '700' },
  gomStatusBanner: { marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  summaryCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  lostBanner: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginVertical: 8, borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  lostBannerTitle: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  lostBannerText: { fontSize: 12, color: '#991b1b', marginTop: 4 },
  projectCard: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  backToListBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  backToListText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  collapsible: { marginTop: 8, borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 10, overflow: 'hidden' },
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc' },
  collapsibleTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  collapsibleArrow: { fontSize: 11, color: '#94a3b8' },
  collapsibleBody: { padding: 12 },
  attachRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  attachName: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  attachMeta: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  attachBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  attachBtnText: { fontSize: 14 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  commentInput: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  commentField: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', maxHeight: 80, borderWidth: 1, borderColor: '#e2e8f0' },
  commentSendBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  commentSendText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  commentItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  commentStageBadge: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8 },
  commentStageText: { fontSize: 10, fontWeight: '600' },
  commentContent: { fontSize: 13, color: '#334155', marginTop: 4 },
  commentDate: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  auditItem: { flexDirection: 'row', paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#e2e8f0', marginLeft: 6, paddingLeft: 12 },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', position: 'absolute', left: -5, top: 12 },
  auditAction: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  auditUser: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  auditChanges: { fontSize: 11, color: '#64748b', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  editLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4, marginTop: 6 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  inlineInput: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'center' },
  pickerTrigger: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTriggerText: { fontSize: 14, color: '#0f172a', flex: 1 },
  pickerArrow: { fontSize: 10, color: '#94a3b8', marginLeft: 8 },
  datePickerBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  datePickerText: { fontSize: 14, color: '#0f172a' },
  calIcon: { fontSize: 18 },
  calcField: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 8 },
  calcLabel: { fontSize: 12, color: '#64748b' },
  calcValue: { fontSize: 16, fontWeight: '700', color: '#10b981', marginTop: 2 },
  unitRow: { flexDirection: 'row', gap: 4 },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  unitBtnActive: { backgroundColor: '#6366f1' },
  unitText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  unitTextActive: { color: '#fff' },
  addResBtn: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addResBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  yearBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#f1f5f9' },
  yearBtnActive: { backgroundColor: '#6366f1' },
  yearBtnText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  yearBtnTextActive: { color: '#fff' },
  rcItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  rcRole: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  rcMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  rcAdd: { fontSize: 24, color: '#6366f1', fontWeight: '700', paddingHorizontal: 8 },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 15, color: '#0f172a' },
  quoteCard: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8 },
  quoteLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase' },
  quoteValue: { fontSize: 24, fontWeight: '700', color: '#10b981', marginTop: 4 },
  saveFab: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  saveFabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalCancelText: { fontWeight: '600', color: '#64748b' },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center' },
  modalConfirmText: { fontWeight: '600', color: '#fff' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 6 },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
