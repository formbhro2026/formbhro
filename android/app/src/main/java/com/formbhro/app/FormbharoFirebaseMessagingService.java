package com.formbhro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.FirebaseMessagingPlugin;
import android.app.ActivityManager;
import java.util.List;
import java.util.Map;

public class FormbharoFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FormbharoFCM";
    private static final String CHANNEL_ID_CALLS = "formbhro_calls_v3";
    private static final String CHANNEL_ID_MESSAGES = "formbhro_messages_v3";
    private static final String CHANNEL_ID_DEFAULT = "formbhro_default_v3";

    private static final Map<String, Long> sRecentMessageIds = new java.util.concurrent.ConcurrentHashMap<>();
    private static final Map<String, Long> sRecentCallSessions = new java.util.concurrent.ConcurrentHashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            ensureChannels(manager);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        MainActivity.broadcastFcmToken(this, token);
        String prefix = token.length() > 10 ? token.substring(0, 10) + "..." : "";
        Log.i(TAG, "[CALL][FCM] onNewToken received: " + prefix);
        try {
            FirebaseMessagingPlugin.onNewToken(token);
        } catch (Throwable t) {
            Log.w(TAG, "[CALL][FCM] Plugin onNewToken forwarding warning: " + t.getMessage());
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "[CALL][FCM] onMessageReceived triggered, id=" + remoteMessage.getMessageId());

        // Forward to Capacitor plugin so foreground listeners receive event.
        // NOTE: This may fail if the app is killed (no active activity). Always continue
        // regardless so the native notification is posted in background/killed state.
        try {
            FirebaseMessagingPlugin.onMessageReceived(remoteMessage);
        } catch (Throwable t) {
            Log.w(TAG, "[CALL][FCM] Plugin onMessageReceived forwarding warning (app may be killed): " + t.getMessage());
        }

        Map<String, String> data = remoteMessage.getData();

        // When FCM delivers a notification+data message (our new payload format), the system
        // automatically shows the notification when the app is killed. However, when the app
        // is in the background (but not killed), onMessageReceived IS called and we must
        // post the native notification ourselves. When app is foreground, we suppress it and
        // let the React layer handle it.
        String type = null;
        if (data != null && !data.isEmpty()) {
            type = data.get("type");
            if (type == null) {
                type = data.get("notification_type");
            }
        }
        Log.i(TAG, "[CALL][FCM] onMessageReceived type=" + type);

        if ("call".equalsIgnoreCase(type)) {
            handleIncomingCallPush(data, remoteMessage);
        } else {
            // For message/default notifications: post native notification when app is NOT foreground.
            // When app is killed, the FCM notification block in the payload already shows the OS
            // notification — we guard against duplicate posting via the isForeground check inside.
            handleIncomingMessagePush(data != null ? data : new java.util.HashMap<>(), remoteMessage);
        }
    }

    private void ensureChannels(NotificationManager manager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            AudioAttributes callAudioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

            AudioAttributes msgAudioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            Uri msgSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);            // Calls channels
            for (String chId : new String[]{CHANNEL_ID_CALLS, "formbhro_calls_v2"}) {
                if (manager.getNotificationChannel(chId) == null) {
                    NotificationChannel callChannel = new NotificationChannel(
                        chId,
                        "Incoming Calls",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    callChannel.setDescription("Alerts for incoming audio and video calls");
                    callChannel.enableVibration(true);
                    callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
                    callChannel.enableLights(true);
                    callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    callChannel.setBypassDnd(true);
                    // Ringer audio is exclusively handled by IncomingCallActivity.startRingtoneAndVibration
                    callChannel.setSound(null, null);
                    manager.createNotificationChannel(callChannel);
                    Log.i(TAG, "[CALL][NATIVE] Created channel: " + chId);
                }
            }

            // Messages channels
            for (String chId : new String[]{CHANNEL_ID_MESSAGES, "formbhro_messages_v2"}) {
                if (manager.getNotificationChannel(chId) == null) {
                    NotificationChannel msgChannel = new NotificationChannel(
                        chId,
                        "Messages & Updates",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    msgChannel.setDescription("New message alerts from experts and team members");
                    msgChannel.enableVibration(true);
                    msgChannel.enableLights(true);
                    msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    if (msgSoundUri != null) {
                        msgChannel.setSound(msgSoundUri, msgAudioAttributes);
                    }
                    manager.createNotificationChannel(msgChannel);
                    Log.i(TAG, "[MESSAGE][NATIVE] Created channel: " + chId);
                }
            }

            // Default fallback channel
            for (String chId : new String[]{CHANNEL_ID_DEFAULT, "formbhro_default_v2"}) {
                if (manager.getNotificationChannel(chId) == null) {
                    NotificationChannel defChannel = new NotificationChannel(
                        chId,
                        "General Notifications",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    defChannel.setDescription("General system and request updates");
                    defChannel.enableVibration(true);
                    defChannel.enableLights(true);
                    defChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    manager.createNotificationChannel(defChannel);
                    Log.i(TAG, "[MESSAGE][NATIVE] Created channel: " + chId);
                }
            }
        }
    }

    private void handleIncomingMessagePush(Map<String, String> data, RemoteMessage remoteMessage) {
        if (MainActivity.isAppInForeground) {
            Log.i(TAG, "[MESSAGE][NATIVE] App is in foreground, suppressing notification tray alert.");
            return;
        }

        if (remoteMessage != null && remoteMessage.getNotification() != null) {
            Log.i(TAG, "[MESSAGE][NATIVE] Notification already posted by Android Google Play Services, skipping manual notification.");
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            ensureChannels(manager);
        }

        // Deduplication: prevent duplicate push notification within 30 seconds
        String msgDedupKey = data.get("notificationId");
        if (msgDedupKey == null || msgDedupKey.isEmpty()) {
            msgDedupKey = data.get("messageId");
        }
        if (msgDedupKey == null || msgDedupKey.isEmpty()) {
            String cId = data.get("chatRoomId");
            String rId = data.get("requestId");
            String b = data.get("body");
            if (b != null && (cId != null || rId != null)) {
                msgDedupKey = (cId != null ? cId : rId) + ":" + b.trim();
            }
        }
        if (msgDedupKey == null || msgDedupKey.isEmpty()) {
            msgDedupKey = remoteMessage.getMessageId();
        }

        if (msgDedupKey != null && !msgDedupKey.isEmpty()) {
            long now = System.currentTimeMillis();
            Long lastSeen = sRecentMessageIds.get(msgDedupKey);
            if (lastSeen != null && (now - lastSeen) < 30000) {
                Log.i(TAG, "[MESSAGE][NATIVE] Duplicate message push notification suppressed for key: " + msgDedupKey);
                return;
            }
            sRecentMessageIds.put(msgDedupKey, now);
            if (sRecentMessageIds.size() > 200) {
                sRecentMessageIds.entrySet().removeIf(e -> (now - e.getValue()) > 60000);
            }
        }

        String title = data.get("title");
        String body = data.get("body");
        if (title == null || title.trim().isEmpty()) {
            RemoteMessage.Notification notif = remoteMessage.getNotification();
            if (notif != null && notif.getTitle() != null) {
                title = notif.getTitle();
            } else {
                title = "Formbhro";
            }
        }
        if (body == null || body.trim().isEmpty()) {
            RemoteMessage.Notification notif = remoteMessage.getNotification();
            if (notif != null && notif.getBody() != null) {
                body = notif.getBody();
            } else {
                body = "New message received";
            }
        }

        String requestId = data.get("requestId");
        String chatRoomId = data.get("chatRoomId");
        String route = data.get("route");

        String tag = "msg_" + (msgDedupKey != null ? msgDedupKey : "general");
        int notificationId = Math.abs(tag.hashCode());

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (route != null && !route.isEmpty()) {
            intent.putExtra("route", route);
        }
        if (requestId != null && !requestId.isEmpty()) {
            intent.putExtra("requestId", requestId);
        }
        if (chatRoomId != null && !chatRoomId.isEmpty()) {
            intent.putExtra("chatRoomId", chatRoomId);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            flags
        );

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            try {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Formbharo:MessagePushWakeLock"
                );
                wakeLock.acquire(3000);
            } catch (Throwable ignored) {}
        }

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setColor(Color.parseColor("#FF8A1F"))
            .setSound(defaultSoundUri)
            .setVibrate(new long[]{0, 500, 200, 500})
            .setLights(Color.parseColor("#FF8A1F"), 1000, 1000)
            .setContentIntent(pendingIntent);

        if (manager != null) {
            manager.notify(tag, notificationId, builder.build());
            Log.i(TAG, "[MESSAGE][NATIVE] Message notification posted: tag=" + tag + " id=" + notificationId);
        }
    }

    private void handleIncomingCallPush(Map<String, String> data, RemoteMessage remoteMessage) {
        String callSessionId = data.get("callSessionId");
        String requestId = data.get("requestId");
        String chatRoomId = data.get("chatRoomId");
        String callerName = data.get("callerName");
        String callerId = data.get("callerId");

        // Idempotency: prevent processing the same call session multiple times within 30 seconds
        if (callSessionId != null && !callSessionId.isEmpty()) {
            long now = System.currentTimeMillis();
            Long lastSeen = sRecentCallSessions.get(callSessionId);
            if (lastSeen != null && (now - lastSeen) < 30000) {
                Log.i(TAG, "[CALL][NATIVE] Duplicate incoming call push suppressed for session: " + callSessionId);
                return;
            }
            sRecentCallSessions.put(callSessionId, now);
            if (sRecentCallSessions.size() > 100) {
                sRecentCallSessions.entrySet().removeIf(e -> (now - e.getValue()) > 60000);
            }
        }

        if (callerName == null || callerName.trim().isEmpty()) {
            RemoteMessage.Notification notif = remoteMessage.getNotification();
            if (notif != null && notif.getTitle() != null) {
                callerName = notif.getTitle();
            } else {
                callerName = "Formbhro Support";
            }
        }
        String callType = data.get("callType");
        if (callType == null || callType.trim().isEmpty()) {
            callType = "voice";
        }
        String route = data.get("route");

        Log.i(TAG, "[CALL][NATIVE] Processing call: session=" + callSessionId + " req=" + requestId +
                   " caller=" + callerName + " callerId=" + callerId + " type=" + callType + " route=" + route);
        Log.i("CALL_FORENSIC", "[CALL FORENSIC] role=TEAM event=FCM_RECEIVED messageId=" + remoteMessage.getMessageId() + " callSessionId=" + callSessionId + " requestId=" + requestId + " callType=" + callType + " timestamp=" + System.currentTimeMillis());

        // Foreground check strictly based on MainActivity lifecycle
        boolean isForeground = MainActivity.isAppInForeground;
        if (isForeground) {
            Log.i(TAG, "[CALL][NATIVE] App is in FOREGROUND. React CallOverlay handles presentation. Suppressing native IncomingCallActivity & ringtone.");
            Log.i("CALL_FORENSIC", "[CALL FORENSIC] role=TEAM event=FCM_FOREGROUND_SUPPRESSED callSessionId=" + callSessionId + " requestId=" + requestId + " timestamp=" + System.currentTimeMillis());
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            ensureChannels(manager);
        }

        int notificationId = (callSessionId != null ? callSessionId.hashCode() : (int) System.currentTimeMillis());

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Full Screen Intent to IncomingCallActivity
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("callSessionId", callSessionId);
        fullScreenIntent.putExtra("requestId", requestId);
        fullScreenIntent.putExtra("chatRoomId", chatRoomId);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callerId", callerId);
        fullScreenIntent.putExtra("callType", callType);
        fullScreenIntent.putExtra("route", route);
        fullScreenIntent.putExtra("notificationId", notificationId);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            fullScreenIntent,
            flags
        );

        // Action: Decline
        Intent declineIntent = new Intent(this, IncomingCallActionReceiver.class);
        declineIntent.setAction("ACTION_DECLINE_CALL");
        declineIntent.putExtra("notificationId", notificationId);
        declineIntent.putExtra("callSessionId", callSessionId);
        declineIntent.putExtra("requestId", requestId);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            this,
            notificationId + 1,
            declineIntent,
            flags
        );

        // Action: Answer
        Intent answerIntent = new Intent(this, IncomingCallActivity.class);
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        answerIntent.putExtra("callSessionId", callSessionId);
        answerIntent.putExtra("requestId", requestId);
        answerIntent.putExtra("chatRoomId", chatRoomId);
        answerIntent.putExtra("callerName", callerName);
        answerIntent.putExtra("callerId", callerId);
        answerIntent.putExtra("callType", callType);
        answerIntent.putExtra("route", route);
        answerIntent.putExtra("notificationId", notificationId);
        answerIntent.putExtra("autoAnswer", true);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(
            this,
            notificationId + 2,
            answerIntent,
            flags
        );

        String callTypeTitle = callType.equalsIgnoreCase("video") ? "Incoming Video Call" : "Incoming Voice Call";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_CALLS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(callerName)
            .setContentText(callTypeTitle)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setColor(Color.parseColor("#FF8A1F"))
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(0, "Decline", declinePendingIntent)
            .addAction(0, "Answer", answerPendingIntent);

        // Acquire WakeLock to turn screen on and prevent CPU sleep during call alert
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "formbhro:incoming_call_wake"
                );
                wakeLock.acquire(15000);
            }
        } catch (Throwable t) {
            Log.w(TAG, "[CALL][NATIVE] WakeLock warning: " + t.getMessage());
        }

        // Start native ringtone and vibration immediately for full call alert experience
        IncomingCallActivity.startRingtoneAndVibration(this);

        if (manager != null) {
            manager.notify(notificationId, builder.build());
            Log.i(TAG, "[CALL][NATIVE] Notification posted: id=" + notificationId);

            // Auto-cancel and stop ringtone after 45 seconds if missed/unanswered
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                IncomingCallActivity.stopRingtone();
                if (manager != null) {
                    manager.cancel(notificationId);
                }
            }, 45000);
        }
    }
}
