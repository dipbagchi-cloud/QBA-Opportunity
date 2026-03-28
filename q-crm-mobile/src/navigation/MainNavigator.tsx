import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {MainTabParamList} from './types';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import {OpportunitiesNavigator} from './OpportunitiesNavigator';
import ContactsScreen from '../screens/contacts/ContactsScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import ChatbotScreen from '../screens/chatbot/ChatbotScreen';
import GomCalculatorScreen from '../screens/gom/GomCalculatorScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import {colors, typography} from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Simple emoji tab icons — replace with react-native-vector-icons once installed
const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '🏠',
  Opportunities: '💼',
  Contacts: '👥',
  Analytics: '📊',
  AI: '✨',
  GOM: '🧮',
  Settings: '⚙️',
};

// Shorter display labels for tabs that are too long
const TAB_LABELS: Partial<Record<keyof MainTabParamList, string>> = {
  Opportunities: 'Deals',
};

function TabIcon({icon, focused}: {icon: string; focused: boolean}) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Text style={styles.icon}>{icon}</Text>
    </View>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused}) => (
          <TabIcon icon={TAB_ICONS[route.name as keyof MainTabParamList]} focused={focused} />
        ),
        tabBarLabel: ({focused, color}) => (
          <Text style={[styles.tabLabel, {color}]}>
            {TAB_LABELS[route.name as keyof MainTabParamList] || route.name}
          </Text>
        ),
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Opportunities" component={OpportunitiesNavigator} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="AI" component={ChatbotScreen} />
      <Tab.Screen name="GOM" component={GomCalculatorScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.border.light,
    borderTopWidth: 1,
    paddingTop: 4,
    height: 64,
  },
  tabItem: {
    paddingVertical: 2,
    minWidth: 50,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 30,
  },
  iconContainerActive: {
    // visual indicator handled by tint color
  },
  icon: {
    fontSize: 22,
    textAlign: 'center',
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 9,
    marginBottom: 4,
    textAlign: 'center',
  },
});
