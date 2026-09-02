import { Check, CheckCheck, Clock, RotateCw } from "lucide-react";
import { DocumentMessage } from "@/components/chat/DocumentMessage";
import { CallEventBubble } from "@/components/chat/CallEventBubble";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/data/user-module";

export function MessageBubble({
  message,
  onRetry,
  onViewFile,
  currentUserId,
  onCallBack,
}: {
  message: ChatMessage;
  onRetry: (id: string) => void;
  onViewFile: (fileId: string) => void;
  currentUserId?: string;
  onCallBack?: (type: "audio" | "video") => void;
}) {
  if (message.callLog) {
    return (
      <CallEventBubble
        callLog={message.callLog}
        time={message.time}
        currentUserId={currentUserId}
        onCallBack={onCallBack}
      />
    );
  }

  const isMine =
    currentUserId && message.senderId
      ? message.senderId === currentUserId
      : message.author === "user";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
        isMine ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[85%] px-3 py-1.5 text-[15px] leading-relaxed shadow-sm sm:max-w-[75%] lg:max-w-[65%] border-none transition-all duration-200",
          isMine
            ? "rounded-[18px] rounded-tr-[4px] bg-chat-out text-chat-text"
            : "rounded-[18px] rounded-tl-[4px] bg-chat-in text-chat-text",
          message.file && "p-0.5 pb-0",
        )}
      >
        {message.file ? (
          <div className="overflow-hidden rounded-[16px]">
            <DocumentMessage
              name={message.file.name}
              kind={message.file.kind}
              size={message.file.size}
              previewUrl={message.file.previewUrl}
              pageCount={message.file.pageCount}
              dimensions={message.file.dimensions}
              time={message.time}
              tone={isUser ? "emerald" : "dark"}
              onView={() => onViewFile(message.file!.id)}
            />
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="whitespace-pre-wrap break-words">{message.text}</span>
            <div className="flex items-center justify-end gap-1 mt-0.5 ml-8 self-end">
              <span className="text-[10px] text-chat-meta font-medium leading-none">
                {message.time}
              </span>
              {isUser && message.state && (
                <span className="flex items-center ml-0.5">
                  {message.state === "sending" && (
                    <Clock className="h-3 w-3 text-chat-meta opacity-70" />
                  )}
                  {message.state === "sent" && (
                    <Check className="h-3.5 w-3.5 text-chat-meta opacity-70" strokeWidth={1.5} />
                  )}
                  {message.state === "delivered" && (
                    <CheckCheck
                      className="h-3.5 w-3.5 text-chat-meta opacity-70"
                      strokeWidth={1.5}
                    />
                  )}
                  {message.state === "read" && (
                    <CheckCheck className="h-3.5 w-3.5 text-chat-accent" strokeWidth={2} />
                  )}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {isUser && message.state === "failed" && (
        <button
          type="button"
          onClick={() => onRetry(message.id)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold text-danger text-[10px] uppercase bg-danger/5 hover:bg-danger/10 transition-colors"
        >
          <RotateCw className="h-2.5 w-2.5" aria-hidden="true" /> Retry sending
        </button>
      )}
    </div>
  );
}
