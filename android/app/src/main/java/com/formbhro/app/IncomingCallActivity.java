package com.formbhro.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.os.VibrationEffect;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {
    private static final String TAG = "IncomingCallActivity";
    private static Ringtone sRingtone = null;
    private static Vibrator sVibrator = null;

    private final android.os.Handler autoTimeoutHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable autoTimeoutRunnable = () -> onDeclineCall();

    private String callSessionId;
    private String requestId;
    private String chatRoomId;
    private String callerName;
    private String callType; // "voice" or "video"
    private String route;
    private int notificationId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Auto-dismiss call screen after 45 seconds if unanswered
        autoTimeoutHandler.postDelayed(autoTimeoutRunnable, 45000);

        // Turn on screen & show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );

        // Extract intent data
        Intent intent = getIntent();
        callSessionId = intent.getStringExtra("callSessionId");
        requestId = intent.getStringExtra("requestId");
        chatRoomId = intent.getStringExtra("chatRoomId");
        callerName = intent.getStringExtra("callerName");
        if (callerName == null || callerName.trim().isEmpty()) {
            callerName = "Formbhro Support";
        }
        String callerId = intent.getStringExtra("callerId");
        callType = intent.getStringExtra("callType");
        if (callType == null || callType.trim().isEmpty()) {
            callType = "voice";
        }
        route = intent.getStringExtra("route");
        notificationId = intent.getIntExtra("notificationId", 1001);

        Log.i(TAG, "[CALL][ACTIVITY] onCreate: session=" + callSessionId + " req=" + requestId +
                   " caller=" + callerName + " callerId=" + callerId + " type=" + callType + " route=" + route);

        // Start ringing and vibration
        startRingtoneAndVibration(this);

        // Build Full-Screen UI programmatically
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#090A0F"));
        root.setPadding(48, 120, 48, 80);

        // Top Header
        TextView headerLabel = new TextView(this);
        headerLabel.setText(callType.equalsIgnoreCase("video") ? "INCOMING VIDEO CALL" : "INCOMING VOICE CALL");
        headerLabel.setTextColor(Color.parseColor("#FF8A1F"));
        headerLabel.setTextSize(13);
        headerLabel.setTypeface(Typeface.DEFAULT_BOLD);
        headerLabel.setGravity(Gravity.CENTER);
        root.addView(headerLabel);

        // Caller Avatar Circle
        LinearLayout avatarContainer = new LinearLayout(this);
        avatarContainer.setOrientation(LinearLayout.VERTICAL);
        avatarContainer.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(220, 220);
        avatarParams.topMargin = 80;
        avatarParams.bottomMargin = 40;
        avatarContainer.setLayoutParams(avatarParams);

        GradientDrawable avatarBg = new GradientDrawable();
        avatarBg.setShape(GradientDrawable.OVAL);
        avatarBg.setColor(Color.parseColor("#1B1F2E"));
        avatarBg.setStroke(4, Color.parseColor("#FF8A1F"));
        avatarContainer.setBackground(avatarBg);

        TextView avatarLetter = new TextView(this);
        String initial = callerName.length() > 0 ? callerName.substring(0, 1).toUpperCase() : "F";
        avatarLetter.setText(initial);
        avatarLetter.setTextColor(Color.WHITE);
        avatarLetter.setTextSize(36);
        avatarLetter.setTypeface(Typeface.DEFAULT_BOLD);
        avatarLetter.setGravity(Gravity.CENTER);
        avatarContainer.addView(avatarLetter);
        root.addView(avatarContainer);

        // Caller Name
        TextView nameView = new TextView(this);
        nameView.setText(callerName);
        nameView.setTextColor(Color.WHITE);
        nameView.setTextSize(26);
        nameView.setTypeface(Typeface.DEFAULT_BOLD);
        nameView.setGravity(Gravity.CENTER);
        root.addView(nameView);

        // Subtitle / Status
        TextView statusView = new TextView(this);
        statusView.setText("Ringing...");
        statusView.setTextColor(Color.parseColor("#9CA3AF"));
        statusView.setTextSize(15);
        statusView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        statusParams.topMargin = 12;
        statusView.setLayoutParams(statusParams);
        root.addView(statusView);

        // Flexible spacer
        View spacer = new View(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1.0f
        );
        spacer.setLayoutParams(spacerParams);
        root.addView(spacer);

        // Bottom Action Buttons (Decline & Answer)
        LinearLayout actionsLayout = new LinearLayout(this);
        actionsLayout.setOrientation(LinearLayout.HORIZONTAL);
        actionsLayout.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams actionsParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        actionsParams.bottomMargin = 60;
        actionsLayout.setLayoutParams(actionsParams);

        // Decline Button (Red)
        Button declineBtn = new Button(this);
        declineBtn.setText("DECLINE");
        declineBtn.setTextColor(Color.WHITE);
        declineBtn.setTextSize(15);
        declineBtn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable declineBg = new GradientDrawable();
        declineBg.setShape(GradientDrawable.RECTANGLE);
        declineBg.setCornerRadius(100f);
        declineBg.setColor(Color.parseColor("#DC2626"));
        declineBtn.setBackground(declineBg);
        LinearLayout.LayoutParams declineParams = new LinearLayout.LayoutParams(0, 140, 1.0f);
        declineParams.rightMargin = 24;
        declineBtn.setLayoutParams(declineParams);
        declineBtn.setOnClickListener(v -> onDeclineCall());
        actionsLayout.addView(declineBtn);

        // Answer Button (Green)
        Button answerBtn = new Button(this);
        answerBtn.setText("ANSWER");
        answerBtn.setTextColor(Color.WHITE);
        answerBtn.setTextSize(15);
        answerBtn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable answerBg = new GradientDrawable();
        answerBg.setShape(GradientDrawable.RECTANGLE);
        answerBg.setCornerRadius(100f);
        answerBg.setColor(Color.parseColor("#16A34A"));
        answerBtn.setBackground(answerBg);
        LinearLayout.LayoutParams answerParams = new LinearLayout.LayoutParams(0, 140, 1.0f);
        answerParams.leftMargin = 24;
        answerBtn.setLayoutParams(answerParams);
        answerBtn.setOnClickListener(v -> onAnswerCall());
        actionsLayout.addView(answerBtn);

        root.addView(actionsLayout);
        setContentView(root);
    }

    private void onAnswerCall() {
        Log.i(TAG, "[CALL][ACTIVITY] onAnswerCall clicked for session=" + callSessionId);
        stopRingtone();
        dismissNotification();

        // Launch MainActivity and pass call session parameters
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.setAction("ACTION_INCOMING_CALL_ANSWERED");
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        mainIntent.putExtra("callSessionId", callSessionId);
        mainIntent.putExtra("requestId", requestId);
        mainIntent.putExtra("chatRoomId", chatRoomId);
        mainIntent.putExtra("callerName", callerName);
        mainIntent.putExtra("callType", callType);
        mainIntent.putExtra("autoAnswer", true);
        if (route != null && !route.isEmpty()) {
            mainIntent.putExtra("route", route);
        }
        startActivity(mainIntent);
        finish();
    }

    private void onDeclineCall() {
        stopRingtone();
        dismissNotification();
        finish();
    }

    private void dismissNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(notificationId);
        }
    }

    public static synchronized void startRingtoneAndVibration(Context context) {
        try {
            if (sRingtone == null) {
                Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                if (ringtoneUri != null) {
                    sRingtone = RingtoneManager.getRingtone(context.getApplicationContext(), ringtoneUri);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && sRingtone != null) {
                        sRingtone.setAudioAttributes(
                            new AudioAttributes.Builder()
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                .build()
                        );
                    }
                    if (sRingtone != null) {
                        sRingtone.play();
                    }
                }
            }

            if (sVibrator == null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm != null) sVibrator = vm.getDefaultVibrator();
                } else {
                    sVibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                }
                if (sVibrator != null) {
                    long[] pattern = {0, 1000, 800, 1000, 800};
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        sVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        sVibrator.vibrate(pattern, 0);
                    }
                }
            }
        } catch (Exception e) {
            // Ignore ringtone playback failures
        }
    }

    public static synchronized void stopRingtone() {
        try {
            if (sRingtone != null && sRingtone.isPlaying()) {
                sRingtone.stop();
            }
            sRingtone = null;

            if (sVibrator != null) {
                sVibrator.cancel();
            }
            sVibrator = null;
        } catch (Exception e) {
            // Ignore
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        autoTimeoutHandler.removeCallbacks(autoTimeoutRunnable);
        stopRingtone();
    }
}
