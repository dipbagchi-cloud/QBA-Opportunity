import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';
import {AuthNavigator} from './AuthNavigator';
import {MainNavigator} from './MainNavigator';
import {useAuthStore} from '../lib/auth-store';
import {Spinner} from '../components/ui/Spinner';
import {setUnauthorizedHandler} from '../lib/api';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SearchScreen from '../screens/search/SearchScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const {isAuthenticated, isLoading, initialize, logout} = useAuthStore();

  // Initialize auth from AsyncStorage on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Wire up the 401 logout handler from api.ts
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  if (isLoading) {
    return <Spinner fullScreen label="Loading..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
