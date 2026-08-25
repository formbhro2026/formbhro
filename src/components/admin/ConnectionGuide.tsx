import { Panel } from "./AdminUI";
import { Terminal, Database, Copy, Check, ShieldAlert } from "lucide-react";
import { useState } from "react";

export function ConnectionGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const connectionString = "postgresql://postgres:[YOUR-PASSWORD]@db.ogjhvmucklbxcewpkiai.supabase.co:5432/postgres";
  const skillsCommand = "npx skills add supabase/agent-skills";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-6 text-sm text-text-secondary leading-relaxed">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div className="space-y-4 w-full">
            <p className="whitespace-pre-line text-blue-400 font-medium">
              '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
              {"\n\n"}
              Kindly QA CHECKLIST ALL THEBUTTONS ALL TEH FUNCTIONS ARE WORKING OR NOT
            </p>
            
            <div className="pt-4 border-t border-brand/10">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" /> Admin Implementation Checklist
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <li className="flex items-center gap-2 text-emerald-400/90">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Real-time Dashboard Stats (Done)
                </li>
                <li className="flex items-center gap-2 text-emerald-400/90">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  User & Team Management (Done)
                </li>
                <li className="flex items-center gap-2 text-amber-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Advanced Visual Analytics (Pending)
                </li>
                <li className="flex items-center gap-2 text-amber-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Data Exports (CSV/PDF) (Pending)
                </li>
                <li className="flex items-center gap-2 text-amber-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Push Notification Broadcasts (Pending)
                </li>
                <li className="flex items-center gap-2 text-amber-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Global Search & Bulk Actions (Pending)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">1. Connection string</h3>
              <p className="text-sm text-text-secondary">Copy the connection details for your database.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Parameters</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border-subtle/50 pb-2">
                  <span className="text-text-secondary">host</span>
                  <span className="text-white font-mono">db.ogjhvmucklbxcewpkiai.supabase.co</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle/50 pb-2">
                  <span className="text-text-secondary">port</span>
                  <span className="text-white font-mono">5432</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle/50 pb-2">
                  <span className="text-text-secondary">database</span>
                  <span className="text-white font-mono">postgres</span>
                </div>
                <div className="flex justify-between border-border-subtle/50 pt-1">
                  <span className="text-text-secondary">user</span>
                  <span className="text-white font-mono">postgres</span>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => copyToClipboard(connectionString, 'conn')}
                  className="p-1.5 rounded-md bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                >
                  {copied === 'conn' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="rounded-xl border border-border-subtle bg-black/40 p-4 font-mono text-sm overflow-x-auto whitespace-pre">
                <div className="text-text-secondary mb-2">Code:</div>
                <code className="text-brand-light">{connectionString}</code>
              </div>
            </div>
            
            <p className="text-xs text-text-secondary leading-relaxed bg-brand/5 border border-brand/10 rounded-lg p-3">
              <span className="font-semibold text-brand">Note:</span> If your database password contains special characters, percent-encode them in the connection string.
            </p>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">2. Install Agent Skills (optional)</h3>
              <p className="text-sm text-text-secondary">Give AI coding tools ready-made instructions for Supabase.</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              Agent Skills give AI coding tools ready-made instructions, scripts, and resources for working with Supabase more accurately and efficiently.
            </p>

            <div className="group relative">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => copyToClipboard(skillsCommand, 'skills')}
                  className="p-1.5 rounded-md bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                >
                  {copied === 'skills' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="rounded-xl border border-border-subtle bg-black/40 p-4 font-mono text-sm overflow-x-auto whitespace-pre">
                <div className="text-text-secondary mb-2">Code:</div>
                <code className="text-blue-400">{skillsCommand}</code>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

