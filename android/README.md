# DA Games — Android (APK)

Capacitor wrapper: the web app is bundled inside the APK and runs offline.

## Build

Requires JDK 21 and the Android SDK (platform 35, build-tools 35).

```sh
cd android
npm install
node ../tools/build-android-web.mjs [--maintenance findit]   # copies the web app to android/www
npx cap sync android
cd android
export ANDROID_HOME=/path/to/android-sdk
# signed release (the SAME keystore must be used for every update, or the phone
# will refuse to install over the previous version):
export DAGAMES_KEYSTORE=/path/to/dagames.keystore DAGAMES_STORE_PASSWORD=... DAGAMES_KEY_ALIAS=dagames
./gradlew assembleRelease     # → app/build/outputs/apk/release/app-release.apk
```

`--maintenance <id,...>` swaps those games for an "under maintenance" screen and
leaves their files out of the APK.

The keystore is NOT in this repository (keep it safe and private). Bump
`versionCode` / `versionName` in `android/app/build.gradle` for each release.
