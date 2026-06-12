import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';
import { BreathingOverlay } from './src/screens/BreathingOverlay';

registerRootComponent(App);
AppRegistry.registerComponent('BlockingOverlay', () => BreathingOverlay);
