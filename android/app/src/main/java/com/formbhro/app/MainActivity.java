package com.formbhro.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import android.Manifest;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isAppInForeground = false;
    private String pendingCallAnswerJs = null;
    private String pendingCallAnswerJson = null;

    public class FormbharoNativeBridge {
        @android.webkit.JavascriptInterface
        public String getPendingCallAnswer() {
            android.util.Log.i("MainActivity", "[CALL][BRIDGE] Native bridge getPendingCallAnswer: " + pendingCallAnswerJson);
            return pendingCallAnswerJson != null ? pendingCallAnswerJson : "";
        }

        @android.webkit.JavascriptInterface
        public void clearPendingCallAnswer() {
            android.util.Log.i("MainActivity", "[CALL][BRIDGE] Native bridge clearPendingCallAnswer");
            pendingCallAnswerJson = null;
            pendingCallAnswerJs = null;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new FormbharoNativeBridge(), "FormbharoNativeBridge");
        }
        
        handleCallIntent(getIntent());
        
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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        boolean autoAnswer = intent.getBooleanExtra("autoAnswer", false);
        String action = intent.getAction();
        if (autoAnswer || "ACTION_INCOMING_CALL_ANSWERED".equals(action)) {
            final String callSessionId = intent.getStringExtra("callSessionId") != null ? intent.getStringExtra("callSessionId") : "";
            final String requestId = intent.getStringExtra("requestId") != null ? intent.getStringExtra("requestId") : "";
            final String chatRoomId = intent.getStringExtra("chatRoomId") != null ? intent.getStringExtra("chatRoomId") : "";
            final String callType = intent.getStringExtra("callType") != null ? intent.getStringExtra("callType") : "voice";
            final String route = intent.getStringExtra("route") != null ? intent.getStringExtra("route") : "";

            // Clear intent extras to prevent duplicate execution on onResume or configuration change
            intent.removeExtra("autoAnswer");
            intent.setAction(null);
            setIntent(new Intent());

            android.util.Log.i("MainActivity", "[CALL][BRIDGE] Handling call answer intent: session=" + callSessionId + " req=" + requestId + " route=" + route);
            android.util.Log.i("CALL_FORENSIC", "[CALL FORENSIC] role=TEAM event=INCOMING_CALL_BRIDGE callSessionId=" + callSessionId + " requestId=" + requestId + " timestamp=" + System.currentTimeMillis());

            pendingCallAnswerJson = String.format(
                "{\"callSessionId\":\"%s\",\"requestId\":\"%s\",\"chatRoomId\":\"%s\",\"callType\":\"%s\",\"route\":\"%s\",\"autoAnswer\":true,\"timestamp\":%d}",
                escapeJs(callSessionId),
                escapeJs(requestId),
                escapeJs(chatRoomId),
                escapeJs(callType),
                escapeJs(route),
                System.currentTimeMillis()
            );

            final String js = String.format(
                "window.__FORMBHARO_PENDING_CALL_ANSWER__ = {" +
                "  callSessionId: '%s'," +
                "  requestId: '%s'," +
                "  chatRoomId: '%s'," +
                "  callType: '%s'," +
                "  route: '%s'," +
                "  autoAnswer: true," +
                "  timestamp: %d" +
                "};" +
                "window.dispatchEvent(new CustomEvent('formbhro:call_answered', {" +
                "  detail: window.__FORMBHARO_PENDING_CALL_ANSWER__" +
                "}));",
                escapeJs(callSessionId),
                escapeJs(requestId),
                escapeJs(chatRoomId),
                escapeJs(callType),
                escapeJs(route),
                System.currentTimeMillis()
            );

            deliverJsToWebView(js);
        }
    }

    private void deliverJsToWebView(final String js) {
        pendingCallAnswerJs = js;
        long[] delays = new long[]{0, 300, 700, 1400, 2400, 4000, 6000, 8000};
        for (long delay : delays) {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (pendingCallAnswerJs != null && MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                    android.util.Log.i("MainActivity", "[CALL][BRIDGE] Evaluating JS in WebView (delay=" + delay + "ms)");
                    MainActivity.this.bridge.getWebView().evaluateJavascript(pendingCallAnswerJs, null);
                }
            }, delay);
        }
    }

    private String escapeJs(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.addJavascriptInterface(new FormbharoNativeBridge(), "FormbharoNativeBridge");
            
            if (pendingCallAnswerJs != null) {
                webView.evaluateJavascript(pendingCallAnswerJs, null);
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isAppInForeground = false;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isAppInForeground = false;
    }
}
