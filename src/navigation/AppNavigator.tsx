import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../colors';
import { getSettings, resyncNativeBlockedApps, subscribeSettings } from '../store/storage';
import { OnboardingScreen1 } from '../screens/onboarding/OnboardingScreen1';
import { OnboardingScreen2 } from '../screens/onboarding/OnboardingScreen2';
import { OnboardingScreen3 } from '../screens/onboarding/OnboardingScreen3';
import { OnboardingScreen4 } from '../screens/onboarding/OnboardingScreen4';
import { OnboardingScreen5 } from '../screens/onboarding/OnboardingScreen5';
import { HomeScreen } from '../screens/HomeScreen';
import { BlockedAppsScreen } from '../screens/BlockedAppsScreen';
import { AddAppsScreen } from '../screens/AddAppsScreen';
import { ConfigurationScreen } from '../screens/ConfigurationScreen';
import { UnlockProgressScreen } from '../screens/UnlockProgressScreen';
import { HomeIcon, ShieldIcon, GearIcon } from '../components/icons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: Colors.accent,
      tabBarInactiveTintColor: Colors.textTertiary,
      tabBarStyle: {
        backgroundColor: Colors.bgSecondary,
        borderTopColor: Colors.bgSecondary,
      },
      tabBarLabelStyle: { fontSize: 11 },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{ tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} /> }}
    />
    <Tab.Screen
      name="BlockedApps"
      component={BlockedAppsScreen}
      options={{ title: 'Blocked Apps', tabBarIcon: ({ color }) => <ShieldIcon size={22} color={color} /> }}
    />
    <Tab.Screen
      name="Settings"
      component={ConfigurationScreen}
      options={{ tabBarIcon: ({ color }) => <GearIcon size={22} color={color} /> }}
    />
  </Tab.Navigator>
);

export const AppNavigator = () => {
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    const refresh = () => {
      try {
        setOnboardingComplete(getSettings().onboardingComplete);
      } catch {
        setOnboardingComplete(false);
      }
    };
    refresh();
    // Prune expired timed blocks and rewrite the native mirror the
    // accessibility service reads — repairs installs whose mirror was never
    // written (e.g. after a failed sync) without waiting for a list edit.
    resyncNativeBlockedApps();
    // Re-read when settings change (e.g. onboarding completes) so the navigator
    // swaps from the onboarding stack to the main app stack.
    return subscribeSettings(refresh);
  }, []);

  const screenOptions = {
    headerShown: false,
    cardStyle: { backgroundColor: Colors.bg },
    gestureEnabled: true,
    ...TransitionPresets.SlideFromRightIOS,
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!onboardingComplete ? (
          <Stack.Group>
            <Stack.Screen name="Onboarding1" component={OnboardingScreen1} />
            <Stack.Screen name="Onboarding2" component={OnboardingScreen2} />
            <Stack.Screen name="Onboarding3" component={OnboardingScreen3} />
            <Stack.Screen name="Onboarding4" component={OnboardingScreen4} />
            <Stack.Screen name="Onboarding5" component={OnboardingScreen5} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen name="AddApps" component={AddAppsScreen} />
            <Stack.Screen name="UnlockProgress" component={UnlockProgressScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
