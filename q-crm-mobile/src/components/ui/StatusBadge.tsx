import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {Badge} from './Badge';
import type {OpportunityStage} from '../../types';

interface StatusBadgeProps {
  stage: OpportunityStage;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const STAGE_VARIANT: Record<OpportunityStage, BadgeVariant> = {
  Lead: 'purple',
  Qualification: 'warning',
  Proposal: 'info',
  Negotiation: 'warning',
  'Closed Won': 'success',
  'Closed Lost': 'danger',
};

export function StatusBadge({stage, style, size}: StatusBadgeProps) {
  return (
    <Badge
      label={stage}
      variant={STAGE_VARIANT[stage]}
      style={style}
      size={size}
    />
  );
}
