import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {OpportunitiesStackParamList} from './types';
import OpportunitiesListScreen from '../screens/opportunities/OpportunitiesListScreen';
import OpportunityDetailScreen from '../screens/opportunities/OpportunityDetailScreen';
import NewOpportunityScreen from '../screens/opportunities/NewOpportunityScreen';

const Stack = createNativeStackNavigator<OpportunitiesStackParamList>();

export function OpportunitiesNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="OpportunitiesList" component={OpportunitiesListScreen} />
      <Stack.Screen name="OpportunityDetail" component={OpportunityDetailScreen} />
      <Stack.Screen name="NewOpportunity" component={NewOpportunityScreen} />
    </Stack.Navigator>
  );
}
