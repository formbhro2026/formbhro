const fs = require('fs');

function patch(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ Capacitor \} from "@capacitor\/core";/, 'import { canShareScreen } from "@/lib/utils";');
  content = content.replace(/typeof window !== "undefined" && !Capacitor\.isNativePlatform\(\)/g, 'canShareScreen()');
  content = content.replace(/!Capacitor\.isNativePlatform\(\)/g, 'canShareScreen()');
  fs.writeFileSync(file, content);
}

patch('src/components/chat/ChatHeader.tsx');
patch('src/routes/admin/_shell/chats.tsx');
patch('src/routes/team/_shell/work.tsx');
