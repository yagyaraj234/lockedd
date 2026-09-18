import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppBlocker } from './modules/app-blocker/src';
import { ThemeProvider, useTheme } from './src/theme';
import { AppMaterial } from './src/components/AppMaterial';
import { AppDialogHost } from './src/components/AppDialog';

const ThemedStatusBar = () => {
  const { name } = useTheme();
  return <StatusBar style={name === 'dark' ? 'light' : 'dark'} />;
};

const DNS_HOSTNAME = 'family.cloudflare-dns.com';

LogBox.ignoreLogs(['InteractionManager has been deprecated']);

export default function App() {
  useEffect(() => {
    try {
      const hasPerm = AppBlocker.hasWriteSecureSettings();
      if (!hasPerm) {
        console.info('[DNS] WRITE_SECURE_SETTINGS not granted — DNS setup skipped.');
        return;
      }
      const before = AppBlocker.getPrivateDns();
      const ok = AppBlocker.setPrivateDns(DNS_HOSTNAME);
      const after = AppBlocker.getPrivateDns();
      if (!ok || after.mode !== 'hostname' || after.specifier !== DNS_HOSTNAME) {
        console.error(`[DNS] setPrivateDns failed. before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
      } else {
        console.log(`[DNS] OK — mode=${after.mode} specifier=${after.specifier}`);
      }
    } catch (e) {
      console.error('[DNS] unexpected error:', e);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppMaterial>
            <AppNavigator />
            <AppDialogHost />
            <ThemedStatusBar />
          </AppMaterial>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
