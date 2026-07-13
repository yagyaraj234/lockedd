import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { getSettings, resyncNativeBlockedApps, subscribeSettings } from '../store/storage';
import { OnboardingFlowScreen } from '../screens/onboarding/OnboardingFlowScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { BlockedAppsScreen } from '../screens/BlockedAppsScreen';
import { AddAppsScreen } from '../screens/AddAppsScreen';
import { ConfigurationScreen } from '../screens/ConfigurationScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { HomeIcon, ShieldIcon, GearIcon } from '../components/icons';
import { MaterialScreen } from '../components/AppMaterial';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TodayTab = (props: any) => <HomeScreen {...props} />;
const BlocksTab = (props: any) => <BlockedAppsScreen {...props} />;
const SettingsTab = (props: any) => <ConfigurationScreen {...props} />;
const AddAppsRoute = (props: any) => <MaterialScreen><AddAppsScreen {...props} /></MaterialScreen>;
const PermissionsRoute = (props: any) => <PermissionsScreen {...props} />;

const TabMaterial = () => {
  const { colors } = useTheme();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />;
};

const MainTabs = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.labelTertiary,
        tabBarBackground: () => <TabMaterial />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 7,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={TodayTab}
        options={{ title: 'Today', tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} /> }}
      />
      <Tab.Screen
        name="BlockedApps"
        component={BlocksTab}
        options={{ title: 'Blocks', tabBarIcon: ({ color }) => <ShieldIcon size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTab}
        options={{ tabBarIcon: ({ color }) => <GearIcon size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  const { colors, name } = useTheme();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    const refresh = () => setOnboardingComplete(getSettings().onboardingComplete);
    refresh();
    resyncNativeBlockedApps();
    return subscribeSettings(refresh);
  }, []);

  const baseTheme = name === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.label,
      border: colors.separator,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        {!onboardingComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingFlowScreen} />
        ) : (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen name="AddApps" component={AddAppsRoute} />
            <Stack.Screen name="Permissions" component={PermissionsRoute} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
