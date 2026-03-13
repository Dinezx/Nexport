import { useMemo, useState } from "react";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

const sanitizeText = (text: string) => {
  // Strip simple markdown bold markers to keep UI clean.
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
};

const initialMessage: ChatMessage = {
  role: "assistant",
  text: [
    "Hello! I'm Nexport AI, your export logistics assistant.",
    "I can help with:",
    "- Export Documentation: Drafting or checking forms.",
    "- Shipment Tracking: Checking shipment status.",
    "- Invoices & Customs: Requirements and billing guidance.",
    "- Nexport Platform: How to use our tools.",
    "",
    "What's on your mind?",
  ].join("\n"),
};

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    return url ? `${url}/functions/v1/ai-chatbot` : "";
  }, []);

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !endpoint || !anonKey) return;
    setError(null);
    setIsLoading(true);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setInput("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg = data?.reply || `AI error (${res.status})`;
        if (res.status === 429) {
          msg = "We're getting rate limited. Please try again in a few seconds.";
        }
        setMessages([...nextMessages, { role: "assistant", text: msg }]);
        return;
      }

      const data = (await res.json()) as { reply?: string };
      const reply = data.reply ?? "Sorry, I couldn't generate a response.";
      setMessages([...nextMessages, { role: "assistant", text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          text: "I hit a network issue. Please try again in a moment.",
        },
      ]);
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-50 flex flex-col items-end gap-2">
      {/* Floating button */}
      <button
        type="button"
        aria-label={isOpen ? "Close Nexport AI" : "Chat with Nexport AI"}
        onClick={() => setIsOpen((v) => !v)}
        className={`rounded-full bg-yellow-400 text-black shadow-lg shadow-black/10 border border-black/5 hover:shadow-xl transition font-semibold ${
          isOpen ? "px-4 py-3" : "h-12 w-12 flex items-center justify-center text-sm"
        }`}
      >
        {isOpen ? "Close Nexport AI" : "AI"}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="mt-2 w-80 sm:w-96 max-h-[75vh] rounded-xl border border-black/10 shadow-2xl bg-white/95 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 bg-gradient-to-r from-yellow-400/80 via-yellow-300/60 to-white/80 flex items-center justify-between">
            <div className="font-semibold text-black">Nexport AI Assistant</div>
            <span className="text-xs text-black/70">Export logistics help</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gradient-to-b from-white to-yellow-50/60">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`rounded-lg px-3 py-2 text-sm leading-relaxed max-w-[90%] whitespace-pre-line shadow-sm ${
                    m.role === "assistant"
                      ? "bg-white text-black border border-black/5"
                      : "bg-yellow-400 text-black border black/10"
                  }`}
                >
                  {sanitizeText(m.text)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-xs text-black/60">Nexport AI is typing...</div>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>

          <div className="border-t border-black/5 p-3 bg-white">
            <div className="flex items-center space-x-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about docs, tracking, invoices..."
                className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-yellow-400 text-black px-3 py-2 text-sm font-semibold border border-black/10 shadow hover:shadow-md disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatbotWidget;
