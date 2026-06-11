import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Colors } from '../colors';
import { getSettings } from '../store/storage';
import { OnboardingScreen1 } from '../screens/onboarding/OnboardingScreen1';
import { OnboardingScreen2 } from '../screens/onboarding/OnboardingScreen2';
import { OnboardingScreen3 } from '../screens/onboarding/OnboardingScreen3';
import { OnboardingScreen4 } from '../screens/onboarding/OnboardingScreen4';
import { OnboardingScreen5 } from '../screens/onboarding/OnboardingScreen5';
import { HomeScreen } from '../screens/HomeScreen';
import { AddAppsScreen } from '../screens/AddAppsScreen';
import { ConfigurationScreen } from '../screens/ConfigurationScreen';
import { UnlockProgressScreen } from '../screens/UnlockProgressScreen';

const Stack = createStackNavigator();

export const AppNavigator = () => {
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    try {
      const settings = getSettings();
      setOnboardingComplete(settings.onboardingComplete);
    } catch {
      setOnboardingComplete(false);
    }
  }, []);

  const screenOptions = {
    headerShown: false,
    cardStyle: { backgroundColor: Colors.bg },
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
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AddApps" component={AddAppsScreen} />
            <Stack.Screen name="Configuration" component={ConfigurationScreen} />
            <Stack.Screen name="UnlockProgress" component={UnlockProgressScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
