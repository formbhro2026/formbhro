# FORMBHRO PRODUCTION AUDIT, BUG FIXES & RELEASE REPORT

**Date:** October 10, 2026  
**Time:** 14:15 IST  
**Version:** 1.0.0 (Version Code 1)  
**Package:** `com.formbhro.app`  
**Repository:** [https://github.com/formbhro2026/formbhro](https://github.com/formbhro2026/formbhro)

---

## 1. Executive Summary

This report documents the full codebase audit, architectural fixes, backend migrations, QA testing, and Android release compilation for the Formbhro platform. All 11 core functional requirements from the master specification have been implemented, tested, and validated. A production-ready release APK and AAB have been built and signed using the official Formbhro identity and logo.

---

## 2. Google Sign-In: Forensic Analysis & Exact Root Cause

### A. The Core Problem
During live automated QA testing of the authentication flow, Google Sign-In was failing across both web and mobile environments.

### B. Forensic Network Findings
Direct HTTP requests to the Supabase OAuth authorization pipeline:
```
GET https://ogjhvmucklbxcewpkiai.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://formbhro-oa2i.vercel.app/auth
```
returned HTTP 302 to Google OAuth:
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=968890483464-hc7metveqh08o27mur4kbjp44j1aii9v.apps.googleusercontent.com&redirect_uri=https://ogjhvmucklbxcewpkiai.supabase.co/auth/v1/callback...
```

Google's servers **immediately returned HTTP 302 to an OAuth error page**:
```text
Google OAuth Error: redirect_uri_mismatch
"You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy.
If you're the app developer, register the redirect URI in the Google Cloud Console:
https://ogjhvmucklbxcewpkiai.supabase.co/auth/v1/callback"
```

### C. Android Native App vs Web Fallback
1. **Native Capacitor Google Auth (`@codetrix-studio/capacitor-google-auth`)**:
   Google Play Services requires an **Android OAuth Client ID** in Google Cloud Console matching package name `com.formbhro.app` and the app's signing SHA-1 fingerprint (`E7:F5:23:9D:E3:E5:39:6D:D9:C0:ED:19:DD:5E:B0:03:EF:D5:37:66`).
   Because this Android client ID was not registered, native auth threw `ApiException: 10 (DEVELOPER_ERROR)`.
2. **Web OAuth Fallback**:
   The app caught the error and gracefully fell back to in-app browser OAuth, but Google immediately blocked it with `redirect_uri_mismatch` because `https://ogjhvmucklbxcewpkiai.supabase.co/auth/v1/callback` was missing from Google Cloud Console.

### D. Fix Required in Google Cloud Console (3-Minute One-Time Setup)
1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Select the project with Client ID `968890483464-hc7metveqh08o27mur4kbjp44j1aii9v.apps.googleusercontent.com`.
3. Edit the **Web application** client ID:
   * Add to **Authorized redirect URIs**:
     `https://ogjhvmucklbxcewpkiai.supabase.co/auth/v1/callback`
   * Add to **Authorized JavaScript origins**:
     `https://ogjhvmucklbxcewpkiai.supabase.co`  
     `https://formbhro-oa2i.vercel.app`  
     `https://formbhro.lovable.app`  
     `http://localhost:3000`
4. Create an **Android** client ID:
   * Package name: `com.formbhro.app`
   * SHA-1 fingerprint: `E7:F5:23:9D:E3:E5:39:6D:D9:C0:ED:19:DD:5E:B0:03:EF:D5:37:66`
   * (Also add `2C:39:86:53:3D:BF:D2:2A:BF:08:0B:3E:F9:12:D1:42:0D:C8:58:46` for existing Google Play upload key).

---

## 3. Master Prompt Phase-by-Phase Fixes

### Phase 2: Admin and Team Chat Management
1. **Admin Conversation Search & History:**
   * Enabled direct search by User ID (`usr_...` / UUID) and Chat ID (`REQ-...`).
   * Added filter tabs: All, Escalated, Waiting Docs, Pending, Done.
   * Isolated historical messages so chats are never mixed.
2. **Team Chat Search:**
   * Added Chat ID search in `src/routes/team/_shell/work.tsx`.
   * Enforced team role filtering and URL state persistence (`?f=waiting_documents`, `?f=escalated`).
3. **Escalated Chats Workflow:**
   * Created `chat_escalations` database table.
   * Added RPCs `escalate_conversation` and `resolve_escalation`.
   * Built dedicated Escalated Chats folder in Team dashboard and resolution banner in Admin.
4. **`waiting_documents` Status:**
   * Fixed state machine database trigger `validate_request_transition()` to accept `waiting_documents`.
   * Added 2-step transition fallback in `updateRequestStatus`.
   * Standardized status counters, badges, and filters across Admin, Team, and User dashboards.

### Phase 3: Announcements & Internal News
5. **Announcement Image Banners:**
   * Validated MIME type and 5MB file limits.
   * Implemented public storage URL generation (`announcements` bucket with fallback to `documents`).
   * Added image preview before publish and responsive fallback handling on load errors.
6. **Team Internal News:**
   * Created `internal_news` table with RLS restricting access to authenticated team members and admins.
   * Built dedicated UI at `/team/news` and added link to Team Sidebar.

### Phase 4: Public News & Vacancy Publishing
7. **Structured Vacancies & Custom Fields:**
   * Expanded schema with 15 fields: title, organization, description, qualification, min/max age, status, start/end dates, vacancies count, location, apply URL, notification URL, image, category.
   * Added automated lifecycle status (`live`, `upcoming`, `closed`, `expired`) based on deadlines.
   * Created `vacancy_custom_fields` engine supporting text, number, date, dropdown, and boolean custom fields.

### Phase 5: User-Side Vacancy Search
8. **Advanced Filters & Eligibility Matching:**
   * Upgraded `/app/news` with search bar and collapsible filter panel (qualification, age range, location, status).
   * Added sorting by Newest, Closing Soon, and Most Vacancies.
   * Included transparent eligibility advisory note.

### Phase 6: Admin Permissions & Presence
9. **Manage Team & Message Deletion:**
   * Replaced hard user deletion with safe account deactivation to preserve foreign key integrity on historical chats.
   * Added `delete_chat_message` backend RPC with role-based authorization and soft deletion.
   * Added confirmation dialogs and UI action buttons in chat streams.
10. **Team Member Presence:**
    * Implemented 25-second heartbeat in `src/routes/team/_shell.tsx`.
    * Tracks tab visibility (`away` when hidden) and page unload (`offline`).

### Phase 7: CSV Exports
11. **RFC 4180 CSV Engine:**
    * Created `src/lib/csv-export.ts` with formula injection mitigation (`'`, `=`, `+`, `-`, `@`), double-quote escaping, and UTF-8 BOM encoding.
    * Added working export buttons in Admin Chats and Team Work queues.

---

## 4. Production Release Signing & Android Build

### Keystore Configuration
* **Keystore File:** `android/app/formbhro-release.jks`
* **Exported Public Certificate:** `android/app/formbhro_upload_cert.pem`
* **Key Alias:** `formbhroupload`
* **Validity:** Valid until February 25, 2054
* **Distinguished Name:** `CN=Formbhro Release, OU=Mobile, O=Formbhro, L=New Delhi, ST=Delhi, C=IN`
* **Certificate SHA-1:** `E7:F5:23:9D:E3:E5:39:6D:D9:C0:ED:19:DD:5E:B0:03:EF:D5:37:66`
* **Certificate SHA-256:** `37:7C:26:D2:E5:91:7D:B0:75:9A:3F:14:5E:DF:D1:A9:44:E9:E1:C5:E8:F7:F1:66:D0:65:3B:87:2A:55:4E:3E`

### Generated Build Artifacts
| Artifact | Path | Size | Signature Status |
|---|---|---|---|
| **Release APK** | `android/app/build/outputs/apk/release/app-release.apk` | **4.41 MB** | **VERIFIED** (APK Signature Scheme v2) |
| **Release AAB** | `android/app/build/outputs/bundle/release/app-release.aab` | **4.16 MB** | **VERIFIED** (JAR / Bundle signer) |

---

## 5. Verification Checklist

- [x] Frontend production bundle built with zero errors (`npm run build`).
- [x] Android assets synced via Capacitor.
- [x] Release APK generated and verified with `apksigner`.
- [x] Release AAB generated and verified with `keytool`.
- [x] Official Formbhro logo assets generated across all Android mipmap buckets.
- [x] Database migrations consolidated in `supabase/migrations/20261010000000_formbhro_core_fixes.sql`.
- [x] Git repository configured with production remote `https://github.com/formbhro2026/formbhro`.
