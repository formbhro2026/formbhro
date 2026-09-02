package com.formbhro.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class IncomingCallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("ACTION_DECLINE_CALL".equals(action)) {
            // Stop incoming ringtone if playing
            IncomingCallActivity.stopRingtone();

            int notificationId = intent.getIntExtra("notificationId", 1001);
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancel(notificationId);
            }
        }
    }
}
