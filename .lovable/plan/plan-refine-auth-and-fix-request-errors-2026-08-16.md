# Plan - Refine Auth and Fix Request Errors

The user wants to remove Google login for now, relying on email/password for all users, and fix the "We couldn't start your request" error.

## User Review Required

> [!IMPORTANT]
> - By removing Google login, only users created by an admin or those who already have an email/password will be able to sign in.
> - I will verify if a public signup option is needed, but for now, I will keep the existing login form logic which supports email/password.

## Proposed Changes

### Authentication
- **ModernAuthForm.tsx**: Remove the Google login button and associated logic. Ensure the "Continue with Phone" (OTP mock) and Email/Password forms remain functional.
- **auth.ts**: Keep the `signInWithGoogle` function for potential future use but ensure the UI doesn't call it.

### Error Fix: "We couldn't start your request"
- **requests.ts**: I suspect the error is caused by RLS or the `reference` field generation. I will update the `createOrContinueRequest` function to use a more robust reference generation and ensure that if the insert fails, it captures the error correctly.
- **FillNowProvider.tsx**: Improve error reporting to the user so they see the actual error message instead of a generic one.
- **Database**: Re-verify the RLS policies and GRANTS for the `requests` table to ensure authenticated users can insert records.

## Technical Details
- Update `src/components/auth/ModernAuthForm.tsx` to remove the "OR" separator and Google login UI components.
- Modify `src/lib/api/requests.ts` to use `gen_random_uuid()` or a stable timestamp for temporary references.
- Add detailed logging to `FillNowProvider.tsx` catch block to debug the exact failure point if it persists.
- Apply a migration to ensure `authenticated` role has full CRUD on `requests` and `chat_rooms`.

## Verification Plan

### Automated Tests
- Run a Playwright script to attempt a login with email/password (mocking the credentials).
- Run a Playwright script to trigger the "Fill Now" flow and verify the request is created.

### Manual Verification
- Verify the Google button is gone from the `/auth` page.
- Check that "Fill Now" creates a request and navigates to the chat screen.
