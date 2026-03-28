import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, FlatList, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../lib/api';

const STEPS = ['Client & Project', 'Details', 'Schedule & Value'];
const DURATION_UNITS = ['days', 'weeks', 'months'];

export default function NewOpportunityScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  // Form state
  const [form, setForm] = useState({
    clientId: '', clientName: '', region: '', projectType: '', title: '',
    practice: '', salesRepName: '', technology: [] as string[], pricingModel: '',
    expectedDayRate: '', value: '', tentativeStartDate: '', tentativeDuration: '',
    tentativeDurationUnit: 'months', description: '',
  });

  // Date picker
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Dropdown modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState('');
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState<any[]>([]);
  const [pickerMulti, setPickerMulti] = useState(false);

  // Master data queries 
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/api/master/clients') });
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: () => api.get('/api/master/regions') });
  const { data: technologies } = useQuery({ queryKey: ['technologies'], queryFn: () => api.get('/api/master/technologies') });
  const { data: projectTypes } = useQuery({ queryKey: ['projectTypes'], queryFn: () => api.get('/api/master/project-types') });
  const { data: pricingModels } = useQuery({ queryKey: ['pricingModels'], queryFn: () => api.get('/api/master/pricing-models') });
  const { data: salespersons } = useQuery({ queryKey: ['salespersons'], queryFn: () => api.get('/api/master/salespersons') });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/api/master/departments') });

  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/api/opportunities', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      Alert.alert('Success', 'Opportunity created successfully');
      nav.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const openPicker = (field: string, title: string, options: any[], multi = false) => {
    setPickerField(field);
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerMulti(multi);
    setPickerVisible(true);
  };

  const handlePickerSelect = (item: any) => {
    const name = item.name || item;
    if (pickerMulti) {
      const current = form.technology;
      if (current.includes(name)) {
        setForm(f => ({ ...f, technology: current.filter(t => t !== name) }));
      } else {
        setForm(f => ({ ...f, technology: [...current, name] }));
      }
    } else {
      if (pickerField === 'clientId') {
        setForm(f => ({ ...f, clientId: item.id, clientName: item.name }));
      } else {
        setForm(f => ({ ...f, [pickerField]: name }));
      }
      setPickerVisible(false);
    }
  };

  // Auto-calculate end date
  const calcEndDate = useMemo(() => {
    if (!form.tentativeStartDate || !form.tentativeDuration) return '';
    try {
      const start = new Date(form.tentativeStartDate);
      const dur = parseInt(form.tentativeDuration);
      if (isNaN(dur)) return '';
      const end = new Date(start);
      if (form.tentativeDurationUnit === 'months') end.setMonth(end.getMonth() + dur);
      else if (form.tentativeDurationUnit === 'weeks') end.setDate(end.getDate() + dur * 7);
      else end.setDate(end.getDate() + dur);
      return end.toISOString().split('T')[0];
    } catch { return ''; }
  }, [form.tentativeStartDate, form.tentativeDuration, form.tentativeDurationUnit]);

  // Auto-calculate value for staffing
  const isStaffing = form.projectType?.toLowerCase() === 'staffing';
  const calcValue = useMemo(() => {
    if (!isStaffing || !form.expectedDayRate || !form.tentativeDuration) return '';
    const rate = parseFloat(form.expectedDayRate);
    const dur = parseFloat(form.tentativeDuration);
    if (isNaN(rate) || isNaN(dur)) return '';
    const months = form.tentativeDurationUnit === 'months' ? dur : form.tentativeDurationUnit === 'weeks' ? dur / 4.33 : dur / 21.67;
    return (rate * 20 * months).toFixed(0);
  }, [isStaffing, form.expectedDayRate, form.tentativeDuration, form.tentativeDurationUnit]);

  const validate = (): string | null => {
    if (!form.clientId && !form.clientName) return 'Client is required';
    if (!form.title.trim()) return 'Project name is required';
    if (!form.region) return 'Region is required';
    if (!form.projectType) return 'Project type is required';
    if (!form.salesRepName) return 'Sales representative is required';
    if (form.technology.length === 0) return 'At least one technology is required';
    if (!form.tentativeStartDate) return 'Start date is required';
    if (isStaffing && !form.expectedDayRate) return 'Day rate is required for staffing';
    if (!isStaffing && !form.value) return 'Estimated value is required';
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { Alert.alert('Validation', err); return; }

    const body: any = {
      title: form.title,
      clientId: form.clientId || undefined,
      companyName: form.clientName || undefined,
      region: form.region,
      projectType: form.projectType,
      practice: form.practice || undefined,
      salesRepName: form.salesRepName,
      technology: form.technology.join(', '),
      pricingModel: form.pricingModel || undefined,
      expectedDayRate: form.expectedDayRate ? Number(form.expectedDayRate) : undefined,
      value: isStaffing ? Number(calcValue) : Number(form.value),
      tentativeStartDate: form.tentativeStartDate,
      tentativeDuration: form.tentativeDuration || undefined,
      tentativeDurationUnit: form.tentativeDurationUnit,
      tentativeEndDate: calcEndDate || undefined,
      description: form.description || undefined,
    };
    createMut.mutate(body);
  };

  const setField = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <SafeAreaView style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={st.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>New Opportunity</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Steps indicator */}
      <View style={st.stepsRow}>
        {STEPS.map((s, i) => (
          <TouchableOpacity key={s} style={[st.stepItem, step === i && st.stepItemActive]} onPress={() => setStep(i)}>
            <View style={[st.stepCircle, step === i && st.stepCircleActive, step > i && st.stepCircleDone]}>
              <Text style={[st.stepNum, (step === i || step > i) && { color: '#fff' }]}>{step > i ? '✓' : i + 1}</Text>
            </View>
            <Text style={[st.stepText, step === i && st.stepTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {/* STEP 1: Client & Project */}
        {step === 0 && (
          <View>
            <PickerField label="Client *" value={form.clientName || 'Select client'}
              onPress={() => openPicker('clientId', 'Select Client', clients || [])} />
            <InputField label="Project Name *" value={form.title} onChangeText={v => setField('title', v)} placeholder="Enter project name" />
            <PickerField label="Region *" value={form.region || 'Select region'}
              onPress={() => openPicker('region', 'Select Region', regions || [])} />
            <PickerField label="Project Type *" value={form.projectType || 'Select type'}
              onPress={() => openPicker('projectType', 'Select Project Type', projectTypes || [])} />
            <PickerField label="Practice" value={form.practice || 'Select practice'}
              onPress={() => openPicker('practice', 'Select Practice', departments || [])} />
          </View>
        )}

        {/* STEP 2: Details */}
        {step === 1 && (
          <View>
            <PickerField label="Sales Representative *" value={form.salesRepName || 'Select sales rep'}
              onPress={() => openPicker('salesRepName', 'Select Sales Rep', salespersons || [])} />
            <PickerField label="Technology *" value={form.technology.length > 0 ? form.technology.join(', ') : 'Select technologies'}
              onPress={() => openPicker('technology', 'Select Technologies', technologies || [], true)} />
            <PickerField label="Pricing Model" value={form.pricingModel || 'Select model'}
              onPress={() => openPicker('pricingModel', 'Select Pricing Model', pricingModels || [])} />
            <InputField label="Description" value={form.description} onChangeText={v => setField('description', v)}
              placeholder="Optional description" multiline />
          </View>
        )}

        {/* STEP 3: Schedule & Value */}
        {step === 2 && (
          <View>
            <View style={st.formGroup}>
              <Text style={st.inputLabel}>Start Date *</Text>
              <TouchableOpacity style={st.datePickerBtn} onPress={() => setDatePickerVisible(true)}>
                <Text style={form.tentativeStartDate ? st.datePickerText : st.datePickerPlaceholder}>
                  {form.tentativeStartDate || 'Select date'}
                </Text>
                <Text style={st.calIcon}>📅</Text>
              </TouchableOpacity>
            </View>
            {datePickerVisible && (
              <DateTimePicker
                value={form.tentativeStartDate ? new Date(form.tentativeStartDate) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(_event: any, selectedDate?: Date) => {
                  setDatePickerVisible(Platform.OS === 'ios');
                  if (selectedDate) setField('tentativeStartDate', selectedDate.toISOString().split('T')[0]);
                }}
              />
            )}
            <View style={st.durationRow}>
              <View style={{ flex: 2 }}>
                <InputField label="Duration" value={form.tentativeDuration} onChangeText={v => setField('tentativeDuration', v)}
                  placeholder="e.g. 6" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={st.inputLabel}>Unit</Text>
                <View style={st.unitRow}>
                  {DURATION_UNITS.map(u => (
                    <TouchableOpacity key={u} style={[st.unitBtn, form.tentativeDurationUnit === u && st.unitBtnActive]}
                      onPress={() => setField('tentativeDurationUnit', u)}>
                      <Text style={[st.unitText, form.tentativeDurationUnit === u && st.unitTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            {calcEndDate && <FieldDisplay label="End Date (calculated)" value={calcEndDate} />}

            {isStaffing && (
              <InputField label="Expected Day Rate ($) *" value={form.expectedDayRate}
                onChangeText={v => setField('expectedDayRate', v)} placeholder="e.g. 500" keyboardType="numeric" />
            )}
            {isStaffing && calcValue && <FieldDisplay label="Auto-calculated Value" value={`$${Number(calcValue).toLocaleString()}`} />}
            {!isStaffing && (
              <InputField label="Estimated Value ($) *" value={form.value}
                onChangeText={v => setField('value', v)} placeholder="e.g. 500000" keyboardType="numeric" />
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={st.bottomNav}>
        {step > 0 && (
          <TouchableOpacity style={st.prevBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={st.prevBtnText}>← Previous</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={st.nextBtn} onPress={() => setStep(s => s + 1)}>
            <Text style={st.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[st.nextBtn, { backgroundColor: '#10b981' }]} onPress={handleSubmit}
            disabled={createMut.isPending}>
            {createMut.isPending ? <ActivityIndicator color="#fff" /> :
              <Text style={st.nextBtnText}>Create Opportunity</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={st.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList data={pickerOptions} keyExtractor={(item, i) => item.id || item.name || String(i)}
              renderItem={({ item }) => {
                const name = item.name || item;
                const isSelected = pickerMulti
                  ? form.technology.includes(name)
                  : pickerField === 'clientId' ? form.clientId === item.id : (form as any)[pickerField] === name;
                return (
                  <TouchableOpacity style={[st.pickerItem, isSelected && st.pickerItemSelected]} onPress={() => handlePickerSelect(item)}>
                    <Text style={[st.pickerItemText, isSelected && st.pickerItemTextSelected]}>{name}</Text>
                    {isSelected && <Text style={st.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={<Text style={st.emptyText}>No options available</Text>}
            />
            {pickerMulti && (
              <TouchableOpacity style={st.pickerDoneBtn} onPress={() => setPickerVisible(false)}>
                <Text style={st.pickerDoneBtnText}>Done ({form.technology.length} selected)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// === INPUT COMPONENTS ===

function InputField({ label, value, onChangeText, placeholder, multiline, keyboardType }: any) {
  return (
    <View style={st.formGroup}>
      <Text style={st.inputLabel}>{label}</Text>
      <TextInput style={[st.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor="#94a3b8" multiline={multiline} keyboardType={keyboardType} />
    </View>
  );
}

function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const isPlaceholder = value.startsWith('Select');
  return (
    <View style={st.formGroup}>
      <Text style={st.inputLabel}>{label}</Text>
      <TouchableOpacity style={st.pickerTrigger} onPress={onPress}>
        <Text style={[st.pickerTriggerText, isPlaceholder && { color: '#94a3b8' }]} numberOfLines={1}>{value}</Text>
        <Text style={st.pickerArrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.formGroup}>
      <Text style={st.inputLabel}>{label}</Text>
      <View style={[st.input, { backgroundColor: '#f0fdf4' }]}>
        <Text style={{ color: '#10b981', fontWeight: '600', fontSize: 14 }}>{value}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backText: { fontSize: 15, color: '#6366f1', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  stepsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stepItem: { flex: 1, alignItems: 'center' },
  stepItemActive: {},
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepCircleActive: { backgroundColor: '#6366f1' },
  stepCircleDone: { backgroundColor: '#10b981' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  stepText: { fontSize: 10, color: '#94a3b8', fontWeight: '500', textAlign: 'center' },
  stepTextActive: { color: '#6366f1', fontWeight: '700' },
  formGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerTrigger: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTriggerText: { fontSize: 14, color: '#0f172a', flex: 1 },
  pickerArrow: { fontSize: 10, color: '#94a3b8', marginLeft: 8 },
  durationRow: { flexDirection: 'row', gap: 12 },
  unitRow: { flexDirection: 'row', gap: 4, marginTop: 0 },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f1f5f9' },
  unitBtnActive: { backgroundColor: '#6366f1' },
  unitText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  unitTextActive: { color: '#fff' },
  bottomNav: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  prevBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9' },
  prevBtnText: { fontWeight: '600', color: '#64748b' },
  nextBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6366f1' },
  nextBtnText: { fontWeight: '600', color: '#fff' },
  emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 20 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalClose: { fontSize: 20, color: '#94a3b8', padding: 4 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' },
  pickerItemSelected: { backgroundColor: '#f0f0ff' },
  pickerItemText: { fontSize: 15, color: '#0f172a' },
  pickerItemTextSelected: { color: '#6366f1', fontWeight: '600' },
  pickerCheck: { fontSize: 16, color: '#6366f1', fontWeight: '700' },
  pickerDoneBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  pickerDoneBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  datePickerBtn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  datePickerText: { fontSize: 14, color: '#0f172a' },
  datePickerPlaceholder: { fontSize: 14, color: '#94a3b8' },
  calIcon: { fontSize: 18 },
});
