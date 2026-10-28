package com.formbhro.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import android.Manifest;
import android.app.PendingIntent;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    public static volatile MainActivity sInstance = null;
    public static volatile boolean isAppInForeground = false;
    public static volatile String sLatestFcmToken = null;
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

        @android.webkit.JavascriptInterface
        public String getFcmToken() {
            if (sLatestFcmToken == null || sLatestFcmToken.trim().isEmpty()) {
                try {
                    sLatestFcmToken = getSharedPreferences("formbhro_prefs", android.content.Context.MODE_PRIVATE)
                        .getString("fcm_token", null);
                } catch (Throwable ignored) {}
            }
            android.util.Log.i("MainActivity", "[FCM][BRIDGE] Native bridge getFcmToken called: " + (sLatestFcmToken != null ? "present" : "null"));
            return sLatestFcmToken != null ? sLatestFcmToken : "";
        }

        @android.webkit.JavascriptInterface
        public boolean isBatteryOptimizationIgnored() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(android.content.Context.POWER_SERVICE);
                return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
            }
            return true;
        }

        @android.webkit.JavascriptInterface
        public void requestIgnoreBatteryOptimizations() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                try {
                    android.os.PowerManager pm = (android.os.PowerManager) getSystemService(android.content.Context.POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                        Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(android.net.Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                    }
                } catch (Throwable t) {
                    android.util.Log.w("MainActivity", "Failed to launch battery optimization request: " + t.getMessage());
                }
            }
        }

        @android.webkit.JavascriptInterface
        public boolean areNotificationsEnabled() {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            }
            androidx.core.app.NotificationManagerCompat nm = androidx.core.app.NotificationManagerCompat.from(MainActivity.this);
            return nm.areNotificationsEnabled();
        }

        @android.webkit.JavascriptInterface
        public void openNotificationSettings() {
            try {
                Intent intent = new Intent();
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    intent.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                } else {
                    intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(android.net.Uri.parse("package:" + getPackageName()));
                }
                startActivity(intent);
            } catch (Throwable t) {
                android.util.Log.w("MainActivity", "Failed to open notification settings: " + t.getMessage());
            }
        }

        @android.webkit.JavascriptInterface
        public void requestNotificationPermission() {
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1002);
                }
            }
        }

        @android.webkit.JavascriptInterface
        public void postSystemNotification(String title, String body, String route, String requestId) {
            try {
                android.app.NotificationManager manager = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
                if (manager == null) return;

                int notificationId = (int) (System.currentTimeMillis() & 0xfffffff);
                Intent intent = new Intent(MainActivity.this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                if (route != null && !route.isEmpty()) intent.putExtra("route", route);
                if (requestId != null && !requestId.isEmpty()) intent.putExtra("requestId", requestId);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(MainActivity.this, notificationId, intent, flags);

                android.net.Uri defaultSoundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);

                androidx.core.app.NotificationCompat.Builder builder = new androidx.core.app.NotificationCompat.Builder(MainActivity.this, "formbhro_messages_v3")
                    .setSmallIcon(R.drawable.ic_stat_notification)
                    .setContentTitle(title != null && !title.trim().isEmpty() ? title : "Formbhro")
                    .setContentText(body != null && !body.trim().isEmpty() ? body : "New message received")
                    .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
                    .setCategory(androidx.core.app.NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setColor(android.graphics.Color.parseColor("#FF8A1F"))
                    .setSound(defaultSoundUri)
                    .setVibrate(new long[]{0, 500, 200, 500})
                    .setDefaults(androidx.core.app.NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(pendingIntent);

                String tag = "inapp_" + (requestId != null && !requestId.isEmpty() ? requestId : (title != null ? title.hashCode() : "notif"));
                manager.notify(tag, notificationId, builder.build());
                android.util.Log.i("MainActivity", "[NOTIFICATION][BRIDGE] Posted notification to bar: " + title);
            } catch (Throwable t) {
                android.util.Log.w("MainActivity", "[NOTIFICATION][BRIDGE] Failed to post notification: " + t.getMessage());
            }
        }
    }

    public static void broadcastFcmToken(android.content.Context context, String token) {
        if (token == null || token.trim().isEmpty()) return;
        sLatestFcmToken = token;
        try {
            if (context != null) {
                context.getSharedPreferences("formbhro_prefs", android.content.Context.MODE_PRIVATE)
                    .edit().putString("fcm_token", token).apply();
            }
        } catch (Throwable ignored) {}

        if (sInstance != null && sInstance.bridge != null && sInstance.bridge.getWebView() != null) {
            sInstance.runOnUiThread(() -> {
                try {
                    String safeToken = token.replace("'", "\\'");
                    String js = String.format(
                        "(function() {" +
                        "  window.__FORMBHARO_FCM_TOKEN__ = '%s';" +
                        "  window.dispatchEvent(new CustomEvent('formbhro:fcm_token_ready', { detail: { token: '%s' } }));" +
                        "})();",
                        safeToken, safeToken
                    );
                    sInstance.bridge.getWebView().evaluateJavascript(js, null);
                } catch (Throwable ignored) {}
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sInstance = this;

        // Restore cached token immediately
        try {
            String cached = getSharedPreferences("formbhro_prefs", android.content.Context.MODE_PRIVATE)
                .getString("fcm_token", null);
            if (cached != null && !cached.isEmpty()) {
                sLatestFcmToken = cached;
            }
        } catch (Throwable ignored) {}

        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult() != null) {
                        broadcastFcmToken(this, task.getResult());
                        android.util.Log.i("MainActivity", "[FCM] Got native FCM token on launch: " + (sLatestFcmToken.length() > 10 ? sLatestFcmToken.substring(0, 10) + "..." : ""));
                    }
                });
        } catch (Throwable t) {
            android.util.Log.w("MainActivity", "[FCM] Failed to query native FCM token: " + t.getMessage());
        }
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            try {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            } catch (Throwable ignored) {}
        }

        setupWebView();
        
        try {
            handleCallIntent(getIntent());
            handleMessageIntent(getIntent());
        } catch (Throwable t) {
            android.util.Log.w("MainActivity", "Error handling intent: " + t.getMessage());
        }
        
        // Request runtime permissions for Android (Microphone, Camera, Notifications)
        try {
            java.util.List<String> permList = new java.util.ArrayList<>();
            permList.add(Manifest.permission.RECORD_AUDIO);
            permList.add(Manifest.permission.CAMERA);
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
        } catch (Throwable t) {
            android.util.Log.w("MainActivity", "Error requesting permissions: " + t.getMessage());
        }

        // Create high-importance notification channels for incoming calls & messages (Android 8.0+)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
            if (manager != null) {
                android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
                android.net.Uri ringtoneUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE);

                // High-importance Incoming Calls channels (_v3 and _v2)
                for (String chId : new String[]{"formbhro_calls_v3", "formbhro_calls_v2"}) {
                    if (manager.getNotificationChannel(chId) == null) {
                        android.app.NotificationChannel callChannel = new android.app.NotificationChannel(
                            chId,
                            "Incoming Calls",
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        );
                        callChannel.setDescription("Alerts for incoming audio and video calls");
                        callChannel.enableVibration(true);
                        callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
                        callChannel.enableLights(true);
                        callChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                        callChannel.setBypassDnd(true);
                        if (ringtoneUri != null) {
                            callChannel.setSound(ringtoneUri, audioAttributes);
                        }
                        manager.createNotificationChannel(callChannel);
                    }
                }

                // High-importance Messages channels (_v3 and _v2)
                android.media.AudioAttributes msgAudioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
                android.net.Uri msgSoundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);

                for (String chId : new String[]{"formbhro_messages_v3", "formbhro_messages_v2"}) {
                    if (manager.getNotificationChannel(chId) == null) {
                        android.app.NotificationChannel msgChannel = new android.app.NotificationChannel(
                            chId,
                            "Messages & Updates",
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        );
                        msgChannel.setDescription("New message alerts from experts and team members");
                        msgChannel.enableVibration(true);
                        msgChannel.enableLights(true);
                        msgChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                        if (msgSoundUri != null) {
                            msgChannel.setSound(msgSoundUri, msgAudioAttributes);
                        }
                        manager.createNotificationChannel(msgChannel);
                    }
                }

                // Default Notification channels (_v3 and _v2)
                for (String chId : new String[]{"formbhro_default_v3", "formbhro_default_v2"}) {
                    if (manager.getNotificationChannel(chId) == null) {
                        android.app.NotificationChannel defChannel = new android.app.NotificationChannel(
                            chId,
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
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
        handleMessageIntent(intent);
    }

    private void handleMessageIntent(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra("route");
        if (route == null || route.trim().isEmpty()) {
            String requestId = intent.getStringExtra("requestId");
            if (requestId != null && !requestId.trim().isEmpty()) {
                route = "/app/chats/" + requestId.trim();
            }
        }
        if (route != null && !route.trim().isEmpty()) {
            final String targetRoute = route.trim();
            android.util.Log.i("MainActivity", "[MESSAGE][NAV] Handling message intent to route: " + targetRoute);
            // Clear intent extras to avoid repeated navigation on configuration change
            intent.removeExtra("route");
            intent.removeExtra("requestId");

            final String js = String.format(
                "(function() {" +
                "  var target = '%s';" +
                "  if (window.location && window.location.pathname !== target) {" +
                "    console.log('[NativeBridge] Navigating to ' + target);" +
                "    window.location.href = target;" +
                "  }" +
                "})();",
                escapeJs(targetRoute)
            );

            long[] delays = new long[]{300, 800, 1600, 3000};
            for (long delay : delays) {
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                        MainActivity.this.bridge.getWebView().evaluateJavascript(js, null);
                    }
                }, delay);
            }
        }
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
        } else if (intent.getStringExtra("callSessionId") != null && !intent.getStringExtra("callSessionId").trim().isEmpty()) {
            final String callSessionId = intent.getStringExtra("callSessionId");
            final String requestId = intent.getStringExtra("requestId");
            final String chatRoomId = intent.getStringExtra("chatRoomId");
            final String callerName = intent.getStringExtra("callerName");
            final String callerId = intent.getStringExtra("callerId");
            final String callType = intent.getStringExtra("callType");
            final String route = intent.getStringExtra("route");

            intent.removeExtra("callSessionId");
            setIntent(new Intent());

            android.util.Log.i("MainActivity", "[CALL][BRIDGE] Opening IncomingCallActivity from notification tap: session=" + callSessionId);
            Intent callUiIntent = new Intent(this, IncomingCallActivity.class);
            callUiIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            callUiIntent.putExtra("callSessionId", callSessionId);
            callUiIntent.putExtra("requestId", requestId);
            callUiIntent.putExtra("chatRoomId", chatRoomId);
            callUiIntent.putExtra("callerName", callerName);
            callUiIntent.putExtra("callerId", callerId);
            callUiIntent.putExtra("callType", callType);
            callUiIntent.putExtra("route", route);
            startActivity(callUiIntent);
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

    private boolean webViewListenerAdded = false;

    private void setupWebView() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
                webView.addJavascriptInterface(new FormbharoNativeBridge(), "FormbharoNativeBridge");

                if (!webViewListenerAdded) {
                    webViewListenerAdded = true;
                    this.bridge.addWebViewListener(new WebViewListener() {
                        private void injectGoogleAuthHeader(WebView view) {
                            if (view == null) return;
                            String js = "(function(){\n" +
                                "  try {\n" +
                                "    window.Capacitor = window.Capacitor || {};\n" +
                                "    window.Capacitor.PluginHeaders = window.Capacitor.PluginHeaders || [];\n" +
                                "    var found = false;\n" +
                                "    for (var i = 0; i < window.Capacitor.PluginHeaders.length; i++) {\n" +
                                "      if (window.Capacitor.PluginHeaders[i] && window.Capacitor.PluginHeaders[i].name === 'GoogleAuth') {\n" +
                                "        found = true; break;\n" +
                                "      }\n" +
                                "    }\n" +
                                "    if (!found) {\n" +
                                "      window.Capacitor.PluginHeaders.push({\n" +
                                "        name: 'GoogleAuth',\n" +
                                "        methods: [\n" +
                                "          { name: 'signIn', rtype: 'promise' },\n" +
                                "          { name: 'refresh', rtype: 'promise' },\n" +
                                "          { name: 'signOut', rtype: 'promise' },\n" +
                                "          { name: 'initialize', rtype: 'promise' }\n" +
                                "        ]\n" +
                                "      });\n" +
                                "    }\n" +
                                "  } catch(e) {}\n" +
                                "})();";
                            view.evaluateJavascript(js, null);
                        }

                        @Override
                        public void onPageStarted(WebView webView) {
                            injectGoogleAuthHeader(webView);
                        }

                        @Override
                        public void onPageLoaded(WebView webView) {
                            injectGoogleAuthHeader(webView);
                        }
                    });
                }
            }
        } catch (Throwable t) {
            android.util.Log.w("MainActivity", "[SETUP] Error in setupWebView: " + t.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;
        try {
            setupWebView();
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                if (pendingCallAnswerJs != null) {
                    webView.evaluateJavascript(pendingCallAnswerJs, null);
                }
            }
        } catch (Throwable t) {
            android.util.Log.w("MainActivity", "[RESUME] Error in onResume: " + t.getMessage());
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isAppInForeground = false;
    }

    @Override
    public void onStop() {
        super.onStop();
        isAppInForeground = false;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isAppInForeground = false;
        if (sInstance == this) {
            sInstance = null;
        }
    }
}
