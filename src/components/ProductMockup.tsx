import { 
  LayoutDashboard, 
  MessageCircle, 
  FileText, 
  Newspaper, 
  User, 
  LogOut, 
  Plus, 
  MoreVertical, 
  Paperclip, 
  Send,
  CheckCircle2,
  Clock
} from "lucide-react";

export function ProductMockup() {
  return (
    <div className="relative group w-full max-w-[800px]">
      {/* Outer container with premium border and glow */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0A0A0A] shadow-2xl transition-transform duration-500 hover:scale-[1.01] ring-1 ring-white/5">
        
        {/* Mockup Header - Window Controls */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-6 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
          </div>
          <div className="ml-4 h-4 w-32 rounded bg-white/5" />
        </div>

        <div className="flex h-[500px]">
          {/* Sidebar */}
          <aside className="hidden w-56 flex-col border-r border-white/10 bg-black/40 p-4 md:flex">
            <div className="mb-8 flex items-center gap-2 px-2">
              <div className="h-7 w-7 rounded-lg bg-brand flex items-center justify-center">
                 <div className="h-4 w-4 border-2 border-white rounded-sm" />
              </div>
              <span className="text-sm font-bold tracking-tight">FORMBHRO</span>
            </div>
            
            <nav className="flex-1 space-y-1">
              <div className="flex items-center gap-3 rounded-xl bg-brand/10 px-3 py-2 text-brand text-xs font-semibold">
                <Plus className="h-4 w-4" />
                New Request
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-text-secondary text-xs hover:text-white transition-colors cursor-pointer">
                <LayoutDashboard className="h-4 w-4" />
                My Dashboard
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-text-secondary text-xs hover:text-white transition-colors cursor-pointer">
                <MessageCircle className="h-4 w-4" />
                My Chats
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-text-secondary text-xs hover:text-white transition-colors cursor-pointer">
                <FileText className="h-4 w-4" />
                My Documents
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-text-secondary text-xs hover:text-white transition-colors cursor-pointer">
                <Newspaper className="h-4 w-4" />
                News & Updates
              </div>
            </nav>

            <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
              <div className="flex items-center gap-3 px-3 py-2 text-text-secondary text-xs hover:text-white transition-colors cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-text-secondary text-xs hover:text-white transition-colors cursor-pointer">
                <LogOut className="h-4 w-4" />
                Logout
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex flex-1 flex-col bg-[#050505]">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold">Passport Application Assistance</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">In Progress</span>
                  <span className="text-[10px] text-text-secondary">#REQ-4920</span>
                </div>
              </div>
              <button className="text-text-secondary hover:text-white">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://w0.peakpx.com/wallpaper/580/678/wallpaper-whatsapp-dark-mode-doodle-background.jpg')] bg-repeat bg-[length:400px_auto] bg-opacity-[0.03]">
              {/* Message: Support */}
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[10px] font-bold text-brand">ST</div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-surface-2 border border-white/10 p-3 shadow-sm">
                  <p className="text-xs leading-relaxed">Hello! How can we assist you with your passport application today?</p>
                  <span className="mt-1 block text-[9px] text-text-secondary text-right">10:05 AM</span>
                </div>
              </div>

              {/* Message: You */}
              <div className="flex items-start justify-end gap-3">
                <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-brand-dark border border-white/10 p-3 shadow-md">
                  <p className="text-xs leading-relaxed text-white">Hi, I need help with the form and document verification.</p>
                  <span className="mt-1 block text-[9px] text-white/80 text-right">10:08 AM</span>
                </div>
              </div>

              {/* Message: Support */}
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[10px] font-bold text-brand">ST</div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-surface-2 border border-white/10 p-3 shadow-sm">
                  <p className="text-xs leading-relaxed">Sure! Please upload the required documents so we can review them.</p>
                  <span className="mt-1 block text-[9px] text-text-secondary text-right">10:10 AM</span>
                </div>
              </div>
            </div>

            {/* Chat Input */}
            <div className="border-t border-white/10 p-4">
              <div className="flex items-center gap-2 rounded-2xl bg-surface-2 border border-white/10 px-4 py-2">
                <Paperclip className="h-4 w-4 text-text-muted cursor-pointer hover:text-white" />
                <div className="flex-1 text-xs text-text-muted">Type a message...</div>
                <div className="h-8 w-8 rounded-xl bg-brand flex items-center justify-center text-white shadow-lg shadow-brand/20">
                  <Send className="h-4 w-4" />
                </div>
              </div>
            </div>
          </main>

          {/* Right Panel */}
          <aside className="hidden w-64 flex-col border-l border-white/10 bg-black/20 p-5 lg:flex">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Request Details</h4>
            
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] text-text-secondary uppercase">Status</label>
                <div className="mt-1 flex items-center gap-2 text-xs font-medium">
                   <Clock className="h-3.5 w-3.5 text-brand" />
                   In Progress
                </div>
              </div>
              <div>
                <label className="text-[10px] text-text-secondary uppercase">Assigned To</label>
                <div className="mt-1 flex items-center gap-2 text-xs font-medium text-white">
                   <div className="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/40" />
                   Priya Sharma
                </div>
              </div>
              <div>
                <label className="text-[10px] text-text-secondary uppercase">Documents (4)</label>
                <div className="mt-2 space-y-2">
                  {['Aadhar Card.pdf', 'Photo.jpg', 'Address Proof.pdf', 'Form.docx'].map(doc => (
                    <div key={doc} className="flex items-center justify-between rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-2 text-[10px]">
                      <span className="truncate max-w-[120px] text-text-secondary">{doc}</span>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </div>
                  ))}
                </div>
                <button className="mt-3 text-[10px] font-bold text-brand hover:underline">View All</button>
              </div>
            </div>
          </aside>
        </div>

        {/* Glossy reflection overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/[0.03] via-transparent to-white/[0.05]" />
      </div>

      {/* Decorative Glows */}
      <div className="absolute -bottom-10 -right-10 h-64 w-64 bg-brand/10 blur-[100px] -z-10" />
      <div className="absolute -top-10 -left-10 h-64 w-64 bg-brand/5 blur-[100px] -z-10" />
    </div>
  );
}
