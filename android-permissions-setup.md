# Android Permissions Setup for WebRTC Calling and Screen Sharing

## Required Permissions

To enable calling and screen sharing in the Android APK, you need to add the following permissions to your Android manifest file.

## Steps to Add Permissions

1. **Sync Capacitor to create Android project** (if not already done):

   ```bash
   npm run cap:sync
   ```

2. **Open the Android manifest file**:

   ```
   android/app/src/main/AndroidManifest.xml
   ```

3. **Add these permissions inside the `<manifest>` tag** (before the `<application>` tag):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.CAPTURE_VIDEO_OUTPUT" />
<uses-permission android:name="android.permission.CAPTURE_AUDIO_OUTPUT" />
```

4. **Add hardware requirements** (optional but recommended):

```xml
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
<uses-feature android:name="android.hardware.microphone" android:required="false" />
```

5. **For Android 13+ (API 33+)**, you may also need to add runtime permission requests in your code. The WebRTC hook now includes error handling that will guide users to enable permissions in app settings.

## Build the APK

After adding permissions, rebuild the APK:

```bash
npm run cap:sync
npm run cap:build:debug   # For debug APK
# or
npm run cap:build:release # For release APK
```

## Testing

After installing the updated APK:

1. Grant camera and microphone permissions when prompted
2. Test video calling functionality
3. Test screen sharing functionality

## Troubleshooting

If permissions are still not working:

1. Go to Android Settings > Apps > Formbhro > Permissions
2. Enable Camera and Microphone permissions manually
3. Restart the app and try again
