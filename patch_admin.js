const fs = require('fs');
let content = fs.readFileSync('src/lib/api/admin.functions.ts', 'utf8');
content = content.replace(
  'assigned_team_id: data.team_member_id,',
  'assigned_team_id: data.team_member_id || null,'
);
content = content.replace(
  'status: "assigned" as any,',
  'status: (data.team_member_id ? "assigned" : before?.status || "pending") as any,'
);
fs.writeFileSync('src/lib/api/admin.functions.ts', content);
