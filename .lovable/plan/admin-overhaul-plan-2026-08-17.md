# Admin Overhaul Plan

Enhance the Super Admin Panel to a clean, easy-to-use ERP/SaaS-based experience.

## UI/UX Improvements

- **Dashboard**: Redesign with clean KPI cards, action-oriented charts, and app summary.
- **Navigation**: 
    - Remove: Documents, Notifications (move to topbar), Settings, Activity Logs.
    - Rename: News to "Announcements".
- **Interactivity**: 
    - Users and Requests will be fully clickable for deep-dive management.
    - Admins will be able to see all user-started chats and action logs.

## Feature Enhancements

- **Announcements**: Update creation with Title, Description, Category, and Banner Image upload. These will appear at the top of the user panel.
- **Chat Monitoring**: 
    - Implement a dual-chat view: one to monitor User-Team conversations and another for private Admin-Team chat.
- **Analytics**: Overhaul with organized team engagement data (online hours, activity) visualized via KPIs and charts.

## Technical Details

- **Navigation Cleanup**: Remove obsolete routes and update `AdminSidebar.tsx`.
- **Admin Store Updates**: Enhance `useAdmin` to support analytics data and private admin-team chat rooms.
- **Announcement Schema**: Update `notificationsApi.createNews` and the news form to include `image_url`.
- **Role Redirection**: Ensure admins, team members, and users are redirected to their respective dashboards after login.
- **WhatsApp UI for Admin**: Bring the refined chat UI to the admin monitoring view.
