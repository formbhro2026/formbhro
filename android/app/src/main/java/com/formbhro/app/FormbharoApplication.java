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

    public static final String CHANNEL_ID_CALLS = "formbhro_calls_v2";
    public static final String CHANNEL_ID_MESSAGES = "formbhro_messages_v2";
    public static final String CHANNEL_ID_DEFAULT = "formbhro_default_v2";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    public void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // 1. High-importance Incoming Calls channel (heads-up popup + sound + vibration)
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
                Log.i(TAG, "Notification channel created: " + CHANNEL_ID_CALLS);
            }

            // 2. High-importance Messages channel (heads-up banner + message sound)
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

                AudioAttributes msgAudioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
                Uri msgSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                if (msgSoundUri != null) {
                    msgChannel.setSound(msgSoundUri, msgAudioAttributes);
                }
                manager.createNotificationChannel(msgChannel);
                Log.i(TAG, "Notification channel created: " + CHANNEL_ID_MESSAGES);
            }

            // 3. High-importance Default Notification channel
            if (manager.getNotificationChannel(CHANNEL_ID_DEFAULT) == null) {
                NotificationChannel defChannel = new NotificationChannel(
                    CHANNEL_ID_DEFAULT,
                    "General Notifications",
                    NotificationManager.IMPORTANCE_HIGH
                );
                defChannel.setDescription("General system and request updates");
                defChannel.enableVibration(true);
                defChannel.enableLights(true);
                defChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(defChannel);
                Log.i(TAG, "Notification channel created: " + CHANNEL_ID_DEFAULT);
            }
        }
    }
}
