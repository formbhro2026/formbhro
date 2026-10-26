package com.formbhro.app;

import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

public class FormbharoApplication extends Application {
    private static final String TAG = "FormbharoApp";

    public static final String CHANNEL_ID_CALLS_V3 = "formbhro_calls_v3";
    public static final String CHANNEL_ID_MESSAGES_V3 = "formbhro_messages_v3";
    public static final String CHANNEL_ID_DEFAULT_V3 = "formbhro_default_v3";

    public static final String CHANNEL_ID_CALLS = "formbhro_calls_v2";
    public static final String CHANNEL_ID_MESSAGES = "formbhro_messages_v2";
    public static final String CHANNEL_ID_DEFAULT = "formbhro_default_v2";

    @Override
    public void onCreate() {
        super.onCreate();
        Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "FATAL UNCAUGHT EXCEPTION on thread " + thread.getName(), throwable);
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });
        createNotificationChannels();
    }

    public void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Audio & Ringtone URIs
            AudioAttributes callAudioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

            AudioAttributes msgAudioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            Uri msgSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            // 1. High-importance Incoming Calls channels (_v3 and _v2)
            String[] callChannelIds = new String[]{CHANNEL_ID_CALLS_V3, CHANNEL_ID_CALLS};
            for (String chId : callChannelIds) {
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
                    if (ringtoneUri != null) {
                        callChannel.setSound(ringtoneUri, callAudioAttributes);
                    }
                    manager.createNotificationChannel(callChannel);
                    Log.i(TAG, "Notification channel created: " + chId);
                }
            }

            // 2. High-importance Messages channels (_v3 and _v2)
            String[] msgChannelIds = new String[]{CHANNEL_ID_MESSAGES_V3, CHANNEL_ID_MESSAGES};
            for (String chId : msgChannelIds) {
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
                    Log.i(TAG, "Notification channel created: " + chId);
                }
            }

            // 3. High-importance Default Notification channels (_v3 and _v2)
            String[] defChannelIds = new String[]{CHANNEL_ID_DEFAULT_V3, CHANNEL_ID_DEFAULT};
            for (String chId : defChannelIds) {
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
                    Log.i(TAG, "Notification channel created: " + chId);
                }
            }
        }
    }
}
