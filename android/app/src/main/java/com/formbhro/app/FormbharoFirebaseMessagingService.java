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
    private static final String CHANNEL_ID_CALLS = "formbhro_calls_v2";
    private static final String CHANNEL_ID_MESSAGES = "formbhro_messages_v2";
    private static final String CHANNEL_ID_DEFAULT = "formbhro_default_v2";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
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
            if (manager.getNotificationChannel(CHANNEL_ID_CALLS) == null) {
                NotificationChannel callChannel = new NotificationChannel(
                    CHANNEL_ID_CALLS,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
                );
                callChannel.setDescription("Alerts for incoming audio and video calls");
                callChannel.enableVibration(true);
                callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
                callChannel.enableLights(true);
                callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                callChannel.setBypassDnd(true);

                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
                Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                if (ringtoneUri != null) {
                    callChannel.setSound(ringtoneUri, audioAttributes);
                }
                manager.createNotificationChannel(callChannel);
                Log.i(TAG, "[CALL][NATIVE] Created channel: " + CHANNEL_ID_CALLS);
            }

            if (manager.getNotificationChannel(CHANNEL_ID_MESSAGES) == null) {
                NotificationChannel msgChannel = new NotificationChannel(
                    CHANNEL_ID_MESSAGES,
                    "Messages & Updates",
                    NotificationManager.IMPORTANCE_HIGH
                );
                msgChannel.setDescription("New message alerts from experts and team members");
                msgChannel.enableVibration(true);
                msgChannel.enableLights(true);
                msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(msgChannel);
                Log.i(TAG, "[MESSAGE][NATIVE] Created channel: " + CHANNEL_ID_MESSAGES);
            }
        }
    }

    private void handleIncomingMessagePush(Map<String, String> data, RemoteMessage remoteMessage) {
        boolean isForeground = MainActivity.isAppInForeground;
        if (!isForeground) {
            try {
                ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
                    if (procs != null) {
                        for (ActivityManager.RunningAppProcessInfo proc : procs) {
                            if (proc.processName.equals(getPackageName()) &&
                                proc.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                                isForeground = MainActivity.isAppInForeground;
                                break;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (isForeground) {
            Log.i(TAG, "[MESSAGE][NATIVE] App is in FOREGROUND. Suppressing native system message notification.");
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            ensureChannels(manager);
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

        int notificationId = (int) (System.currentTimeMillis() & 0xfffffff);

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

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setColor(Color.parseColor("#FF8A1F"))
            .setSound(defaultSoundUri)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent);

        if (manager != null) {
            manager.notify(notificationId, builder.build());
            Log.i(TAG, "[MESSAGE][NATIVE] Message notification posted: id=" + notificationId);
        }
    }

    private void handleIncomingCallPush(Map<String, String> data, RemoteMessage remoteMessage) {
        String callSessionId = data.get("callSessionId");
        String requestId = data.get("requestId");
        String chatRoomId = data.get("chatRoomId");
        String callerName = data.get("callerName");
        String callerId = data.get("callerId");
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

        // Fix 3: Suppress native incoming call activity and ringtone if app is already active in foreground.
        // React CallOverlay presents the incoming call and Web Audio plays the ringtone in the active WebView.
        boolean isForeground = MainActivity.isAppInForeground;
        if (!isForeground) {
            try {
                ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
                    if (procs != null) {
                        for (ActivityManager.RunningAppProcessInfo proc : procs) {
                            if (proc.processName.equals(getPackageName()) &&
                                proc.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                                isForeground = MainActivity.isAppInForeground;
                                break;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

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

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

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
            .setSound(ringtoneUri)
            .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
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
