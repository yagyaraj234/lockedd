# How to Build & Install — Locked

The `Locked` app uses **custom native Kotlin modules** (permissions, app-blocker, step-counter, prevention-mode) and custom Android components (accessibility service, device-admin receiver). Because of that:

- **Expo Go cannot run this app.** It only runs pure-JS projects. You must build a real APK.
- All native fixes require a **rebuild** — Metro reload alone is not enough.

---

## 1. One-time environment setup

You need the Android SDK + a JDK. Android Studio bundles a usable JDK (JBR).

```bash
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Add those to your `~/.zshrc` so every shell has them.

Required SDK components (install via Android Studio → SDK Manager, or `sdkmanager`):

- **NDK** `27.1.12297006`
- **Build-Tools** `35.0.0` and `36.x`
- **Platform** `android-35` / `android-36`
- **Platform-Tools** (gives you `adb`)

If `sdkmanager` is missing, install command-line tools:

```bash
cd /tmp
curl -fsSL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
unzip -q cmdtools.zip
mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
cp -R cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"

SM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
yes | "$SM" --licenses
"$SM" "ndk;27.1.12297006" "build-tools;35.0.0" "platforms;android-35"
```

> Verify the NDK is intact (a partial download breaks the build):
> `ls $ANDROID_HOME/ndk/27.1.12297006/source.properties` — must exist.

Install JS dependencies:

```bash
npm install
```

---

## 2. Release APK — for your phone (standalone, recommended)

Self-contained: JS is bundled in, runs **without** your computer or Metro. Signed with the bundled debug keystore (fine for personal sideloading).

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (~87 MB).

### Install on the phone

**Via USB:**

1. Phone → Settings → About phone → tap **Build number** 7× to unlock Developer options.
2. Settings → Developer options → enable **USB debugging**.
3. Plug into the Mac, tap **Allow** on the phone.
4. Install:
   ```bash
   $ANDROID_HOME/platform-tools/adb devices          # confirm phone is listed
   $ANDROID_HOME/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

**Without a cable:** copy the `.apk` to the phone (Drive / email / file transfer), open it, allow "install unknown apps", tap Install.

> It is an **APK, not an AAB** — directly installable. Do not use `bundleRelease` (that produces an `.aab`, which a phone can't install directly).

---

## 3. Debug build — for development on an emulator

Debug builds load JS from the **Metro** dev server, so Metro must be running and reachable.

```bash
# 1. boot an emulator (or connect a device)
$ANDROID_HOME/emulator/emulator -list-avds
$ANDROID_HOME/emulator/emulator -avd <AVD_NAME> &

# 2. build + install + start Metro in one go
npx expo run:android
```

Or manually:

```bash
cd android && ./gradlew :app:assembleDebug
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
$ANDROID_HOME/platform-tools/adb reverse tcp:8081 tcp:8081   # so the device reaches Metro
npx expo start --dev-client
```

JS-only changes hot-reload through Metro. **Native (Kotlin) changes need a rebuild** (`assembleDebug` / `run:android`).

---

## 4. After install — required permissions

Blocking only works once Android grants permissions it won't grant automatically:

1. Open **Locked**, complete onboarding.
2. **Accessibility (critical):** Settings → Accessibility → **Locked** → turn **On**. Without this, nothing is blocked.
3. Grant **Display over other apps** (overlay).
4. Add apps to block in the **Blocked Apps** tab.

Min Android version: **7.0 (API 24)**.

---

## 5. Gotchas (things that have already bitten this project)

- **react-native-mmkv 4.x has no `new MMKV()`** — `MMKV` is a type-only export. Use `createMMKV()`. `src/store/storage.ts` has a silent fallback stub, so a broken MMKV import makes *all* persistence silently no-op.
- **Do not `npm install` without checking `react-native-nitro-modules` survives.** It is MMKV's peer dependency and is **pinned in `package.json`** precisely because npm otherwise prunes it as "extraneous", which breaks MMKV. If it disappears, reinstall the pinned version and rebuild.
- **Expo `AsyncFunction` must use return-style** (`AsyncFunction("x") { ...; result }`), never `{ promise: (Any?) -> Unit -> }` — the latter crashes module export with `MissingTypeConverter` at runtime.
- **tsc-clean / Kotlin-compiles ≠ works.** Always exercise the real native path on a device or emulator before considering native work done.
- For a **Play Store** release, replace the debug keystore: generate your own and set `signingConfigs.release` in `android/app/build.gradle`.
