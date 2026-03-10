import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Send,
  Paperclip,
  MoreVertical,
  User,
  Clock,
  Sparkles,
  AlertCircle,
  Check,
  CheckCheck,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Bot,
  Truck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { checkRateLimit, formatRateLimitStatus } from "@/lib/rateLimit";
import { logTokenUsage } from "@/lib/tokenUsage";
import {
  fetchAllConversations,
  fetchConversationMessages,
  subscribeToMessages,
  insertMessage,
  sendAiMessage,
  saveOfflineMessage,
  Message,
  Conversation,
  ConversationWithDetails,
} from "@/services/chatService";
import { supabase } from "@/lib/supabase";

type SenderRole = "exporter" | "provider" | "ai" | "system";
type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";
type ChatMode = "provider";

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chatMode] = useState<ChatMode>("provider");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [providerTyping, setProviderTyping] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<any>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, DeliveryStatus>>({});

  // Messages are stored per conversation + mode
  // e.g. "conv-offline-xxx:ai" and "conv-offline-xxx:provider"
  const getStorageKey = (convId: string, mode: ChatMode) => `${convId}:${mode}`;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiThinking, providerTyping]);

  // Load all conversations for the current user
  useEffect(() => {
    if (!user) return;
    const loadConversations = async () => {
      setLoadingConvos(true);
      try {
        const allConvos = await fetchAllConversations(user.id);
        setConversations(allConvos);

        const bookingParam = searchParams.get("booking");
        if (bookingParam && allConvos.length > 0) {
          const match = allConvos.find((c) => c.booking_id === bookingParam);
          if (match) {
            setConversation(match);
            return;
          }
        }

        if (allConvos.length > 0 && !conversation) {
          setConversation(allConvos[0]);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        setLoadingConvos(false);
      }
    };
    loadConversations();
  }, [user]);

  // Load messages when conversation or chatMode changes
  useEffect(() => {
    if (!conversation || !user) return;
    const loadMessages = async () => {
      try {
        if (conversation.id.startsWith("conv-offline-")) {
          setRateLimitStatus({ allowed: true, remaining: 99, resetAt: new Date(Date.now() + 3600000) });
        } else {
          try {
            const limitStatus = await checkRateLimit(supabase as any, user.id);
            setRateLimitStatus(limitStatus);
          } catch {
            setRateLimitStatus({ allowed: true, remaining: 99, resetAt: new Date(Date.now() + 3600000) });
          }
        }

        // Load messages for current mode
        const key = getStorageKey(conversation.id, chatMode);
        const stored = localStorage.getItem(`nexport_chat_${key}`);
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
        } else {
          const msgData = await fetchConversationMessages(conversation.id);
          const providerOnly = (msgData || []).filter((m: Message) => m.sender_role !== "ai");
          setMessages(providerOnly);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };
    loadMessages();
  }, [conversation?.id, user, chatMode]);

  // Save messages whenever they change (skip empty to avoid cache corruption)
  useEffect(() => {
    if (!conversation || messages.length === 0) return;
    const key = getStorageKey(conversation.id, chatMode);
    localStorage.setItem(`nexport_chat_${key}`, JSON.stringify(messages));
  }, [messages, conversation?.id, chatMode]);

  // Realtime subscription for new messages in this conversation
  useEffect(() => {
    if (!conversation) return;

    const channel = subscribeToMessages(
      conversation.id,
      (newMsg: Message) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    );

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversation]);

  const selectConversation = (conv: ConversationWithDetails) => {
    setConversation(conv);
    setMessages([]);
    setError(null);
    setRateLimitError(null);
  };

  // Mode switching removed; always provider chat.

  const sendMessage = async () => {
    if (!text.trim() || !conversation || !user) return;
    
    let limitStatus = rateLimitStatus;
    if (!conversation.id.startsWith("conv-offline-")) {
      try {
        limitStatus = await checkRateLimit(supabase as any, user.id);
        setRateLimitStatus(limitStatus);
      } catch {
        limitStatus = { allowed: true, remaining: 99, resetAt: new Date(Date.now() + 3600000) };
      }
    }
    
    if (!limitStatus?.allowed) {
      setRateLimitError(limitStatus?.message || "Rate limit exceeded");
      return;
    }
    
    setError(null);
    setRateLimitError(null);
    setLoading(true);
    
    try {
      const senderRole: SenderRole = user.role === "provider" ? "provider" : "exporter";
      
      const userMsg = await insertMessage({
        conversationId: conversation.id,
        senderId: user.id,
        senderRole: senderRole,
        content: text,
      });
      
      if (!userMsg) {
        toast({ title: "Failed to send message. Please try again.", variant: "destructive" });
        setLoading(false);
        return;
      }
      
      setMessageStatuses((prev) => ({ ...prev, [userMsg.id]: "sent" }));
      setMessages((prev) => [...prev, userMsg]);
      const messageText = text;
      setText("");

      if (chatMode === "ai") {
        // AI mode — always get AI response
        setAiThinking(true);
        try {
          const aiResult = await sendAiMessage({
            message: messageText,
            bookingId: conversation.booking_id,
            conversationId: conversation.id,
          });

          if (aiResult?.offlineMessage) {
            // Override role to ensure AI for this mode
            const aiMsg = { ...aiResult.offlineMessage, sender_role: "ai" as SenderRole, sender_id: "ai" };
            setMessages((prev) => {
              if (prev.some((m) => m.id === aiMsg.id)) return prev;
              return [...prev, aiMsg];
            });
          }
          
          await logTokenUsage(supabase as any, {
            userId: user.id,
            conversationId: conversation.id,
            inputTokens: Math.ceil(messageText.length / 4),
            outputTokens: 256,
            model: import.meta.env.VITE_HF_MODEL || "unknown",
          }).catch(console.error);
        } catch (err) {
          console.error("ai-chat error:", err);
          const errorMsg = err instanceof Error ? err.message : "Network error";
          toast({ title: `AI service error: ${errorMsg}`, variant: "destructive" });
        }
        setAiThinking(false);
      } else {
        // Provider mode — generate simulated response for offline conversations
        const isOfflineConv = conversation.id.startsWith("conv-offline-");
        if (isOfflineConv) {
          setProviderTyping(true);
          try {
            // Small delay to simulate provider typing
            await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
            const providerResult = await sendAiMessage({
              message: messageText,
              bookingId: conversation.booking_id,
              conversationId: `provider-${conversation.id}`,
            });
            if (providerResult?.offlineMessage) {
              const providerMsg = { ...providerResult.offlineMessage, sender_role: "provider" as SenderRole };
              setMessages((prev) => {
                if (prev.some((m) => m.id === providerMsg.id)) return prev;
                return [...prev, providerMsg];
              });
              // Also save to the actual conversation's offline messages
              saveOfflineMessage(conversation.id, providerMsg);
            }
          } catch (err) {
            console.error("Provider simulation error:", err);
          }
          setProviderTyping(false);
        }
      }
    } catch (err) {
      console.error("Send error:", err);
      toast({ title: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ---------- HELPERS ---------- */

  const formatRoute = (conv: ConversationWithDetails) => {
    if (conv.booking_origin && conv.booking_destination) {
      const origin = conv.booking_origin.replace(/,\s*\w+$/, "");
      const dest = conv.booking_destination.replace(/,\s*\w+$/, "");
      return `${origin} → ${dest}`;
    }
    return `Booking ${conv.booking_id.slice(0, 8).toUpperCase()}`;
  };

  const isOwnMessage = (msg: Message) =>
    msg.sender_id === user?.id;

  return (
    <DashboardLayout userType={user?.role === "provider" ? "provider" : "exporter"}>
      <div className="h-[calc(100vh-6rem)] flex rounded-xl border bg-zinc-950 overflow-hidden">

        {/* ——— Conversation Sidebar ——— */}
        <div className="w-80 border-r flex flex-col bg-zinc-900/50">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </h3>
            <span className="text-xs text-zinc-500">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingConvos ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500">No conversations yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Create a booking to start chatting with a container provider.
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={cn(
                    "w-full text-left p-4 border-b border-zinc-800 hover:bg-zinc-800/70 transition-colors",
                    conversation?.id === conv.id && "bg-zinc-800 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-100 truncate max-w-[180px]">
                      {formatRoute(conv)}
                    </span>
                    {conv.booking_status && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        conv.booking_status === "paid" && "bg-green-900/40 text-green-400",
                        conv.booking_status === "in_transit" && "bg-blue-900/40 text-blue-400",
                        conv.booking_status === "completed" && "bg-zinc-700 text-zinc-300",
                        conv.booking_status === "pending_payment" && "bg-yellow-900/40 text-yellow-400",
                      )}>
                        {conv.booking_status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-xs text-zinc-500 truncate">
                      {conv.last_message}
                    </p>
                  )}
                  {conv.last_message_at && (
                    <p className="text-[10px] text-zinc-600 mt-1">
                      {new Date(conv.last_message_at).toLocaleDateString()} {new Date(conv.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ——— Chat Area ——— */}
        <div className="flex-1 flex flex-col min-h-full">
          {/* Header with Mode Tabs */}
          <div className="border-b">
            <div className="p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-white">
                  {conversation ? formatRoute(conversation as ConversationWithDetails) : "NEXPORT Chat"}
                </h3>
                <span className="text-xs text-zinc-500">
                  {conversation ? "Provider Chat" : "Select a conversation"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {rateLimitStatus && (
                  <span className="text-xs text-zinc-400">
                    {formatRateLimitStatus(rateLimitStatus)}
                  </span>
                )}
                <MoreVertical className="text-zinc-400 h-5 w-5" />
              </div>
            </div>

            {/* Mode toggle removed; always provider view */}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mx-4 mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800 flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          {rateLimitError && (
            <div className="mx-4 mt-2 p-3 rounded-lg bg-yellow-900/20 border border-yellow-800 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-300">{rateLimitError}</p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-4 bg-zinc-900/40">
            {!conversation && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <MessageSquare className="h-12 w-12 mb-3 text-zinc-700" />
                <p className="text-sm">Select a conversation to start chatting</p>
              </div>
            )}

            {conversation && messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <User className="h-10 w-10 mb-3 text-blue-400/50" />
                <p className="text-sm font-medium">Provider Chat</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Chat directly with the logistics provider about your shipment.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 group animate-fade-in",
                  isOwnMessage(msg) ? "flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                  msg.sender_role === "provider" ? "bg-blue-900/50" :
                  msg.sender_role === "ai" ? "bg-primary/10" :
                  "bg-zinc-700"
                )}>
                  {msg.sender_role === "ai" ? (
                    <Sparkles className="h-4 w-4 text-primary" />
                  ) : msg.sender_role === "system" ? (
                    <AlertCircle className="h-4 w-4 text-zinc-400" />
                  ) : msg.sender_role === "provider" ? (
                    <Truck className="h-4 w-4 text-blue-400" />
                  ) : (
                    <User className="h-4 w-4 text-zinc-300" />
                  )}
                </div>
                <div className="flex flex-col gap-1 max-w-[70%]">
                  <div className={cn(
                    "px-4 py-2 rounded-lg transition-shadow duration-200 group-hover:shadow-md",
                    msg.sender_role === "system" ? "bg-zinc-800/50 border border-zinc-700" :
                    msg.sender_role === "ai" ? "bg-zinc-800 border border-primary/20" :
                    msg.sender_role === "provider" ? "bg-blue-900/20 border border-blue-800/30" :
                    isOwnMessage(msg) ? "bg-primary/20 border border-primary/30" :
                    "bg-zinc-800"
                  )}>
                    {msg.sender_role === "system" && (
                      <span className="text-[10px] text-zinc-500 block mb-1">System</span>
                    )}
                    {msg.sender_role === "ai" && (
                      <span className="text-[10px] text-primary/70 block mb-1">AI Assistant</span>
                    )}
                    {msg.sender_role === "provider" && (
                      <span className="text-[10px] text-blue-400 block mb-1">Provider</span>
                    )}
                    <p className="text-sm text-zinc-100 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 px-1">
                    <Clock className="h-3 w-3" />
                    {new Date(msg.created_at).toLocaleTimeString()}
                    {messageStatuses[msg.id] && (
                      <>
                        <span>•</span>
                        {messageStatuses[msg.id] === "pending" && (
                          <span className="text-zinc-400">sending...</span>
                        )}
                        {messageStatuses[msg.id] === "sent" && (
                          <><Check className="h-3 w-3" /><span>sent</span></>
                        )}
                        {messageStatuses[msg.id] === "delivered" && (
                          <><CheckCheck className="h-3 w-3 text-blue-400" /><span>delivered</span></>
                        )}
                        {messageStatuses[msg.id] === "failed" && (
                          <><AlertCircle className="h-3 w-3 text-red-400" /><span>failed</span></>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* AI Thinking */}
            {/* AI thinking indicator removed (provider-only view) */}

            {/* Provider Typing */}
            {providerTyping && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <Truck className="h-4 w-4 text-blue-400" />
                </div>
                <div className="bg-blue-900/20 border border-blue-800/30 px-4 py-3 rounded-lg">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce" />
                    <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t flex gap-2">
            <Button variant="ghost" size="icon" disabled={loading || !conversation || !rateLimitStatus?.allowed}>
              <Paperclip />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                !conversation
                  ? "Select a conversation to start chatting"
                  : "Message the provider..."
              }
              disabled={loading || !conversation || !rateLimitStatus?.allowed}
              className="disabled:opacity-50"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !conversation || !rateLimitStatus?.allowed || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
