# Formbhro Application: Manual Release QA Checklist

This document is the final checklist required before production deployment. It targets the physical device interactions, integrations, and end-to-end user journeys that could not be verified in the automated headless environment.

**DO NOT MARK ANY PHYSICAL TEST AS PASS WITHOUT EXECUTING IT ON A REAL DEVICE.**
**Fill out the `[Evidence]` section for every test case.**

---

## 1. WebRTC Verification
**Test Matrix:** Admin (Desktop Browser) ↔ User (Mobile Native App / Browser)

- [ ] **Establish Call**: Ensure an audio + video call successfully connects.
  - *Evidence:* 
- [ ] **Accept/Reject**: Ensure both call acceptance and rejection operate correctly and UI state resets.
  - *Evidence:* 
- [ ] **Permissions**: Ensure OS-level microphone and camera permissions are prompted and handled.
  - *Evidence:* 
- [ ] **Hangup**: Ensure either party hanging up terminates the peer connection and resets the UI for both.
  - *Evidence:* 
- [ ] **Unauthorized Prevention**: Ensure a user cannot initiate or join a call they are not authorized for.
  - *Evidence:* 

---

## 2. FCM (Push Notifications) Verification
**Test Matrix:** Real Android/iOS device with FCM configured.

- [ ] **Background Delivery**: Suspend the mobile app to the background. Send a message from another role. Verify a real OS system notification appears.
  - *Evidence:* 
- [ ] **Notification Interaction**: Tap the OS notification. Verify it opens the application directly to the correct request/chat room.
  - *Evidence:* 

---

## 3. Mobile Lifecycle Verification
**Test Matrix:** Real Android/iOS device.

- [ ] **Missed Message Sync**: Background the app → Send a message from another user → Foreground the app. Verify the missed message synchronizes immediately.
  - *Evidence:* 
- [ ] **No Duplicate Subscriptions**: Repeat the background/foreground cycle 5 times. Verify that sending a new message does not result in duplicate messages appearing in the UI (preventing zombie realtime subscriptions).
  - *Evidence:* 
- [ ] **Network Reconnection**: Disconnect the device from WiFi/Cellular. Send a message. Reconnect the device. Verify the app resyncs the missing data.
  - *Evidence:* 

---

## 4. Staging UAT (End-to-End User Journeys)
**Test Matrix:** Executed by human QA on the Staging environment.

- [ ] **User Journey**: User creates Request → Team Claims → Chat → Notification → Call → Completion.
  - *Evidence:* 
- [ ] **Team Journey**: Team views Queue → Claims Request → Chat → Escalation/Handoff → Completion.
  - *Evidence:* 
- [ ] **Admin Journey**: Admin views Dashboard → Edits Assignment → Chat → Call → Views Analytics.
  - *Evidence:* 

---

## 5. Security Smoke Test
**Test Matrix:** Executed manually to double-verify automated backend RLS tests.

- [ ] **Horizontal Segregation**: Verify User A absolutely cannot access User B data (requests or chats).
  - *Evidence:* 
- [ ] **Team Segregation**: Verify Team A cannot access Team B restricted/assigned data (if applicable to current policies).
  - *Evidence:* 
- [ ] **Vertical Segregation**: Verify normal users absolutely cannot access Admin functions or the Analytics dashboard.
  - *Evidence:* 

---

## 6. Production Pre-Flight
**Test Matrix:** DevOps / Release Engineer checks.

- [ ] **Environment Variables**: All `.env` production secrets are populated.
  - *Evidence:* 
- [ ] **Supabase Project**: Production project is active and scaled appropriately.
  - *Evidence:* 
- [ ] **Edge Functions**: Deployed to production Supabase instance with correct secrets.
  - *Evidence:* 
- [ ] **FCM Config**: Production Firebase Service Account JSON is securely stored and configured.
  - *Evidence:* 
- [ ] **Storage**: Production buckets are created and RLS policies are applied.
  - *Evidence:* 
- [ ] **Auth Redirects**: Supabase Auth Site URL and Redirect URIs point to the production domain.
  - *Evidence:* 
- [ ] **Database Migrations**: Production database schema is fully migrated and matches staging.
  - *Evidence:* 
- [ ] **Domain/SSL**: Production domain DNS is resolved and SSL certificates are active.
  - *Evidence:* 
- [ ] **Backup**: Supabase Point-in-Time Recovery (PITR) or daily backups are enabled.
  - *Evidence:* 
- [ ] **Rollback Plan**: Documented strategy exists to revert to the previous stable release if critical failure occurs.
  - *Evidence:* 

---

## FINAL DECISION

**[ ] GO / [ ] NO-GO**

**RULE:**
- **GO** ONLY if all mandatory physical tests (WebRTC, FCM, Lifecycle), Security Smoke tests, Staging UAT, and Production Pre-Flight items PASS with documented evidence.
- **NO-GO** if ANY critical test fails or lacks physical verification evidence.
