const fs = require('fs');

let file = 'src/routes/admin/_shell/index.tsx';
let content = fs.readFileSync(file, 'utf8');

// The section looks like:
//      <div className="mt-8 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
//        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted px-1">
//          Infrastructure Connection
//        </h2>
//        
//      </div>
// Because I deleted <ConnectionGuide /> using sed, it's just empty now.
// I will use regex to remove that div completely.

content = content.replace(/<div className="mt-8 opacity-50[^]*?Infrastructure Connection[^]*?<\/div>/m, '');
// Also remove the import for ConnectionGuide
content = content.replace(/import \{ ConnectionGuide \} from "@\/components\/admin\/ConnectionGuide";\n?/, '');

fs.writeFileSync(file, content);
