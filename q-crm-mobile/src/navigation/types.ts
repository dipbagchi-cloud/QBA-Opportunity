/**
 * Navigation type definitions for Q-CRM Mobile
 * All route params are typed here for type-safe navigation
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {CompositeScreenProps} from '@react-navigation/native';

// ─── Auth Stack ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
};

// ─── Opportunities Stack ─────────────────────────────────────────────────────

export type OpportunitiesStackParamList = {
  OpportunitiesList: undefined;
  OpportunityDetail: {id: string; name?: string};
  NewOpportunity: undefined;
};

// ─── Contacts Stack ──────────────────────────────────────────────────────────

export type ContactsStackParamList = {
  ContactsList: undefined;
};

// ─── Analytics Stack ─────────────────────────────────────────────────────────

export type AnalyticsStackParamList = {
  Analytics: undefined;
};

// ─── Settings Stack ──────────────────────────────────────────────────────────

export type SettingsStackParamList = {
  Settings: undefined;
};

// ─── Main Tab Navigator ──────────────────────────────────────────────────────

export type MainTabParamList = {
  Dashboard: undefined;
  Opportunities: undefined;
  Contacts: undefined;
  Analytics: undefined;
  AI: undefined;
  GOM: undefined;
  Settings: undefined;
};

// ─── Root Navigator ──────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ─── Screen prop helpers ─────────────────────────────────────────────────────

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export type OpportunitiesListScreenProps = NativeStackScreenProps<
  OpportunitiesStackParamList,
  'OpportunitiesList'
>;

export type OpportunityDetailScreenProps = NativeStackScreenProps<
  OpportunitiesStackParamList,
  'OpportunityDetail'
>;

export type NewOpportunityScreenProps = NativeStackScreenProps<
  OpportunitiesStackParamList,
  'NewOpportunity'
>;

export type ContactsScreenProps = NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>;

export type AnalyticsScreenProps = NativeStackScreenProps<AnalyticsStackParamList, 'Analytics'>;

export type SettingsScreenProps = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;
