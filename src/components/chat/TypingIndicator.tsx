/** WhatsApp-style animated "typing…" bubble shown while the other side types. */
export function TypingIndicator({
  name = "Support team",
  initials = "FB",
}: {
  name?: string;
  initials?: string;
}) {
  return (
    <div className="flex items-end gap-2" role="status" aria-live="polite">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-chat-in text-[10px] font-bold text-chat-text">
        {initials}
      </span>
      <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-chat-in px-3.5 py-3 shadow-sm">
        <span className="sr-only">{name} is typing</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-chat-meta"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
    </div>
  );
}
