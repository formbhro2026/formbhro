package com.formbhro.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import android.Manifest;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        
        // Request runtime permissions for Android (Microphone, Camera, Audio, Notifications)
        java.util.List<String> permList = new java.util.ArrayList<>();
        permList.add(Manifest.permission.RECORD_AUDIO);
        permList.add(Manifest.permission.CAMERA);
        permList.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            permList.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        java.util.List<String> needed = new java.util.ArrayList<>();
        for (String perm : permList) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needed.add(perm);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 1001);
        }

        // Create high-importance notification channels for incoming calls & messages (Android 8.0+)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
            if (manager != null) {
                // High-importance Incoming Calls channel (heads-up popup + sound + vibration)
                android.app.NotificationChannel callChannel = new android.app.NotificationChannel(
                    "formbhro_calls_v2",
                    "Incoming Calls",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                callChannel.setDescription("Alerts for incoming audio and video calls");
                callChannel.enableVibration(true);
                callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
                callChannel.enableLights(true);
                callChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                callChannel.setBypassDnd(true);

                android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
                android.net.Uri ringtoneUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE);
                if (ringtoneUri != null) {
                    callChannel.setSound(ringtoneUri, audioAttributes);
                }

                manager.createNotificationChannel(callChannel);

                // High-importance Messages channel
                android.app.NotificationChannel msgChannel = new android.app.NotificationChannel(
                    "formbhro_messages_v2",
                    "Messages & Updates",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                msgChannel.setDescription("New message alerts from experts and team members");
                msgChannel.enableVibration(true);
                msgChannel.enableLights(true);
                msgChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(msgChannel);

                // Default Notification channel
                android.app.NotificationChannel defChannel = new android.app.NotificationChannel(
                    "formbhro_default_v2",
                    "General Notifications",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                defChannel.setDescription("General system and request updates");
                defChannel.enableVibration(true);
                defChannel.enableLights(true);
                defChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(defChannel);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            
            // Ensure WebRTC getUserMedia permissions are granted in WebView
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        request.grant(request.getResources());
                    });
                }
            });
        }
    }
}
