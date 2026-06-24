import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppBlocker } from './modules/app-blocker/src';
import { ThemeProvider, useTheme } from './src/theme';

const ThemedStatusBar = () => {
  const { name } = useTheme();
  return <StatusBar style={name === 'dark' ? 'light' : 'dark'} />;
};

const DNS_HOSTNAME = 'family.cloudflare-dns.com';

export default function App() {
  useEffect(() => {
    try {
      const hasPerm = AppBlocker.hasWriteSecureSettings();
      if (!hasPerm) {
        console.warn('[DNS] WRITE_SECURE_SETTINGS not granted — DNS cannot be set. Run: adb shell pm grant com.yagyaraj.locked android.permission.WRITE_SECURE_SETTINGS');
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
          <AppNavigator />
          <ThemedStatusBar />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
