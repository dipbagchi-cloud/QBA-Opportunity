import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CURRENCIES = [
  { code: 'USD', symbol: '$', rate: 1 },
  { code: 'EUR', symbol: '€', rate: 0.92 },
  { code: 'GBP', symbol: '£', rate: 0.79 },
  { code: 'INR', symbol: '₹', rate: 83.5 },
  { code: 'SGD', symbol: 'S$', rate: 1.35 },
  { code: 'AUD', symbol: 'A$', rate: 1.52 },
];

const PER_DIEM_USD = 50;
const PER_DIEM_RATE = 85;

export default function GomCalculatorScreen() {
  // Inputs
  const [annualCTC, setAnnualCTC] = useState('1200000');
  const [deliveryMgmt, setDeliveryMgmt] = useState('5');
  const [benchCost, setBenchCost] = useState('10');
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [onsiteAllowance, setOnsiteAllowance] = useState('2802');
  const [markupPercent, setMarkupPercent] = useState('0');
  const [durationMonths, setDurationMonths] = useState('3');
  const [workingDays, setWorkingDays] = useState('55');

  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  const exchangeRate = currency.rate;

  // Core calculations matching web exactly
  const calcs = useMemo(() => {
    const ctc = parseFloat(annualCTC) || 0;
    const delMgmt = parseFloat(deliveryMgmt) || 0;
    const bench = parseFloat(benchCost) || 0;
    const onAllowance = parseFloat(onsiteAllowance) || 0;
    const markup = parseFloat(markupPercent) || 0;

    // Step 1: Adjusted Cost
    const loadingFactor = (delMgmt + bench) / 100;
    const adjustedCost = ctc * (1 + loadingFactor);

    // Step 2: Convert to quotation currency
    const ctcInQuot = adjustedCost / exchangeRate;

    // Step 3: Offshore Cost Per Day (CTC / 220)
    const offshoreCostDay = Math.ceil(ctcInQuot / 220);

    // Step 4: Onsite Cost Per Day
    const perDiemTotal = PER_DIEM_USD * PER_DIEM_RATE;
    const onsiteCostDay = offshoreCostDay + perDiemTotal + onAllowance;

    // Revenue calculations ('markup' mode)
    const offshoreRevDay = offshoreCostDay * (1 + markup / 100);
    const onsiteRevDay = onsiteCostDay * (1 + markup / 100);

    // GOM calculations
    const offshoreGom = offshoreRevDay > 0 ? ((offshoreRevDay - offshoreCostDay) / offshoreRevDay) * 100 : 0;
    const onsiteGom = onsiteRevDay > 0 ? ((onsiteRevDay - onsiteCostDay) / onsiteRevDay) * 100 : 0;

    // Profit margin
    const profitMargin = markup > 0 ? (markup / (1 + markup / 100)) * 100 : 0;

    // Total calculations based on working days
    const days = parseInt(workingDays) || 0;
    const offshoreTotal = offshoreCostDay * days;
    const onsiteTotal = onsiteCostDay * days;
    const offshoreRevTotal = offshoreRevDay * days;
    const onsiteRevTotal = onsiteRevDay * days;

    return {
      adjustedCost, offshoreCostDay, onsiteCostDay,
      offshoreRevDay, onsiteRevDay,
      offshoreGom, onsiteGom, profitMargin,
      offshoreTotal, onsiteTotal, offshoreRevTotal, onsiteRevTotal,
    };
  }, [annualCTC, deliveryMgmt, benchCost, exchangeRate, onsiteAllowance, markupPercent, workingDays]);

  const fmtN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <SafeAreaView style={st.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={st.title}>GOM Calculator</Text>
        <Text style={st.subtitle}>Resource effort estimation and cost calculation</Text>

        {/* Cost Inputs */}
        <View style={st.card}>
          <Text style={st.cardTitle}>💼 Cost Inputs</Text>

          <Text style={st.label}>Annual CTC ({currency.symbol})</Text>
          <TextInput style={st.input} value={annualCTC} onChangeText={setAnnualCTC}
            keyboardType="numeric" placeholderTextColor="#94a3b8" />

          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Delivery Mgmt (%)</Text>
              <TextInput style={st.input} value={deliveryMgmt} onChangeText={setDeliveryMgmt}
                keyboardType="numeric" placeholderTextColor="#94a3b8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Addl. Bench (%)</Text>
              <TextInput style={st.input} value={benchCost} onChangeText={setBenchCost}
                keyboardType="numeric" placeholderTextColor="#94a3b8" />
            </View>
          </View>

          <Text style={st.label}>Currency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {CURRENCIES.map(c => (
              <TouchableOpacity key={c.code} style={[st.chip, currencyCode === c.code && st.chipActive]}
                onPress={() => setCurrencyCode(c.code)}>
                <Text style={[st.chipText, currencyCode === c.code && st.chipTextActive]}>
                  {c.symbol} {c.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={st.infoRow}>
            <Text style={st.infoLabel}>Exchange Rate</Text>
            <Text style={st.infoValue}>1 {currency.code} = {exchangeRate}</Text>
          </View>

          <Text style={st.label}>Onsite Allowance / Loading</Text>
          <TextInput style={st.input} value={onsiteAllowance} onChangeText={setOnsiteAllowance}
            keyboardType="numeric" placeholderTextColor="#94a3b8" />

          <Text style={st.label}>Markup (%)</Text>
          <TextInput style={st.input} value={markupPercent} onChangeText={setMarkupPercent}
            keyboardType="numeric" placeholderTextColor="#94a3b8" />

          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Duration (months)</Text>
              <TextInput style={st.input} value={durationMonths} onChangeText={setDurationMonths}
                keyboardType="numeric" placeholderTextColor="#94a3b8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Working Days</Text>
              <TextInput style={st.input} value={workingDays} onChangeText={setWorkingDays}
                keyboardType="numeric" placeholderTextColor="#94a3b8" />
            </View>
          </View>
        </View>

        {/* Derived Values */}
        <View style={st.card}>
          <Text style={st.cardTitle}>📊 Derived Values</Text>
          <FieldRow label="Adjusted CTC" value={`${currency.symbol} ${fmtN(calcs.adjustedCost)}`} />
          <FieldRow label="Per Diem (USD)" value={`$${PER_DIEM_USD}`} />
          <FieldRow label="Per Diem Rate" value={`${PER_DIEM_RATE}`} />
          <FieldRow label="Loading Factor" value={`${parseFloat(deliveryMgmt) + parseFloat(benchCost)}%`} />
        </View>

        {/* Offshore Results */}
        <View style={[st.card, { borderLeftWidth: 4, borderLeftColor: '#10b981' }]}>
          <Text style={st.cardTitle}>🏢 Offshore</Text>
          <View style={st.resultGrid}>
            <ResultBox label="Cost / Day" value={`$${fmtN(calcs.offshoreCostDay)}`} color="#0f172a" />
            <ResultBox label="Revenue / Day" value={`$${fmtN(calcs.offshoreRevDay)}`} color="#6366f1" />
            <ResultBox label="GOM %" value={`${calcs.offshoreGom.toFixed(1)}%`}
              color={calcs.offshoreGom >= 25 ? '#10b981' : calcs.offshoreGom >= 15 ? '#f59e0b' : '#ef4444'} />
            <ResultBox label={`Total Cost (${workingDays}d)`} value={`$${fmtN(calcs.offshoreTotal)}`} color="#0f172a" />
            <ResultBox label={`Total Rev (${workingDays}d)`} value={`$${fmtN(calcs.offshoreRevTotal)}`} color="#6366f1" />
            <ResultBox label="Profit/Day" value={`$${fmtN(calcs.offshoreRevDay - calcs.offshoreCostDay)}`} color="#10b981" />
          </View>
        </View>

        {/* Onsite Results */}
        <View style={[st.card, { borderLeftWidth: 4, borderLeftColor: '#f59e0b' }]}>
          <Text style={st.cardTitle}>🌍 Onsite</Text>
          <View style={st.resultGrid}>
            <ResultBox label="Cost / Day" value={`$${fmtN(calcs.onsiteCostDay)}`} color="#0f172a" />
            <ResultBox label="Revenue / Day" value={`$${fmtN(calcs.onsiteRevDay)}`} color="#6366f1" />
            <ResultBox label="GOM %" value={`${calcs.onsiteGom.toFixed(1)}%`}
              color={calcs.onsiteGom >= 25 ? '#10b981' : calcs.onsiteGom >= 15 ? '#f59e0b' : '#ef4444'} />
            <ResultBox label={`Total Cost (${workingDays}d)`} value={`$${fmtN(calcs.onsiteTotal)}`} color="#0f172a" />
            <ResultBox label={`Total Rev (${workingDays}d)`} value={`$${fmtN(calcs.onsiteRevTotal)}`} color="#6366f1" />
            <ResultBox label="Profit/Day" value={`$${fmtN(calcs.onsiteRevDay - calcs.onsiteCostDay)}`} color="#10b981" />
          </View>
        </View>

        {/* Summary Table */}
        <View style={st.card}>
          <Text style={st.cardTitle}>📋 Summary Comparison</Text>
          <View style={st.tableHeader}>
            <Text style={[st.tableHeaderText, { flex: 1.5 }]}>Metric</Text>
            <Text style={[st.tableHeaderText, { flex: 1 }]}>Offshore</Text>
            <Text style={[st.tableHeaderText, { flex: 1 }]}>Onsite</Text>
          </View>
          <TableRow label="Cost/Day" v1={`$${fmtN(calcs.offshoreCostDay)}`} v2={`$${fmtN(calcs.onsiteCostDay)}`} />
          <TableRow label="Revenue/Day" v1={`$${fmtN(calcs.offshoreRevDay)}`} v2={`$${fmtN(calcs.onsiteRevDay)}`} />
          <TableRow label="GOM %" v1={`${calcs.offshoreGom.toFixed(1)}%`} v2={`${calcs.onsiteGom.toFixed(1)}%`} />
          <TableRow label="Profit/Day" v1={`$${fmtN(calcs.offshoreRevDay - calcs.offshoreCostDay)}`} v2={`$${fmtN(calcs.onsiteRevDay - calcs.onsiteCostDay)}`} />
          <TableRow label={`Total Cost`} v1={`$${fmtN(calcs.offshoreTotal)}`} v2={`$${fmtN(calcs.onsiteTotal)}`} />
          <TableRow label={`Total Revenue`} v1={`$${fmtN(calcs.offshoreRevTotal)}`} v2={`$${fmtN(calcs.onsiteRevTotal)}`} />
        </View>
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

function ResultBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={st.resultBox}>
      <Text style={st.resultLabel}>{label}</Text>
      <Text style={[st.resultValue, { color }]}>{value}</Text>
    </View>
  );
}

function TableRow({ label, v1, v2 }: { label: string; v1: string; v2: string }) {
  return (
    <View style={st.tableRow}>
      <Text style={[st.tableCell, { flex: 1.5, color: '#64748b' }]}>{label}</Text>
      <Text style={[st.tableCell, { flex: 1, fontWeight: '600' }]}>{v1}</Text>
      <Text style={[st.tableCell, { flex: 1, fontWeight: '600' }]}>{v2}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', gap: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 6 },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, marginBottom: 8 },
  infoLabel: { fontSize: 12, color: '#94a3b8' },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  fieldLabel: { fontSize: 13, color: '#64748b' },
  fieldValue: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultBox: { flex: 1, minWidth: '30%' as any, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, alignItems: 'center' },
  resultLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  resultValue: { fontSize: 16, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeaderText: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f8fafc' },
  tableCell: { fontSize: 13, color: '#0f172a' },
});
