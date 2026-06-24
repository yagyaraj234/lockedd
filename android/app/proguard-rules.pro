# Add project specific ProGuard rules here.

# React Native TurboModules (New Architecture)
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Expo modules
-keep class expo.modules.** { *; }

# react-native-mmkv
-keep class com.tencent.mmkv.** { *; }

# react-native-nitro-modules
-keep class com.margelo.nitro.** { *; }

# react-native-screens
-keep class com.swmansion.rnscreens.** { *; }

# react-native-gesture-handler
-keep class com.swmansion.gesturehandler.** { *; }

# react-native-svg
-keep class com.horcrux.svg.** { *; }

# Accessibility Service (must not be obfuscated)
-keep class com.yagyaraj.locked.** { *; }

# Keep JS interface methods called from native
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Hermes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
