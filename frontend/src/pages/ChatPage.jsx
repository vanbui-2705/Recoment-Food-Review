import { useEffect, useRef, useState } from "react";
import {
  createConversation,
  createIdempotencyKey,
  fetchConversation,
  listConversations,
  readChatEventStream,
  sendConversationMessage,
  streamChatEvents,
} from "../dashboardApi.js";
import { chatMessageToView } from "../dashboardAdapters.js";

export default function ChatPage({
  initialPrompt = "",
  onInitialPromptConsumed = () => {},
  currentLocation,
  profile,
  user,
  onNavigate = () => {},
}) {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState("");
  const sendLock = useRef(false);
  const streamController = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const prompt = initialPrompt.trim();
    if (!prompt) return;
    setInput(prompt);
    onInitialPromptConsumed();
  }, [initialPrompt]);

  const loadConversation = async () => {
    setLoadingHistory(true);
    try {
      setChatError("");
      const list = await listConversations();
      const conversation = list?.items?.[0] || (await createConversation());
      setConversationId(conversation.id);
      const detail = await fetchConversation(conversation.id);
      setMessages((detail?.messages || []).map(chatMessageToView).filter(Boolean));
    } catch {
      setConversationId(null);
      setMessages([]);
      setChatError("Không thể kết nối tới dịch vụ hội thoại.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadConversation();
    return () => {
      active = false;
      streamController.current?.abort();
    };
  }, []);

  const handleNewConversation = async () => {
    if (sending) return;
    try {
      setChatError("");
      const newConv = await createConversation();
      setConversationId(newConv.id);
      setMessages([]);
      setInput("");
    } catch {
      setChatError("Không thể tạo hội thoại mới lúc này.");
    }
  };

  const followRun = async (runId) => {
    streamController.current?.abort();
    const controller = new AbortController();
    streamController.current = controller;
    let after = 0;
    let done = false;
    while (!done && !controller.signal.aborted) {
      const response = await streamChatEvents(runId, after, controller.signal);
      const result = await readChatEventStream(response, (event) => {
        if (event.type !== "RESULT" || !event.payload?.text) return;
        setMessages((current) => [
          ...current,
          {
            id: `run:${runId}:${event.seq}`,
            role: "ASSISTANT",
            text: event.payload.text,
            results: event.payload.results || [],
            createdAt: new Date().toISOString(),
          },
        ]);
      });
      after = Math.max(after, result.after);
      done = result.done;
    }
  };

  const send = async (value = input) => {
    const text = (value || "").trim();
    if (!text || !conversationId || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    const key = createIdempotencyKey();

    try {
      setChatError("");
      const context = {};
      const lat = currentLocation?.latitude ?? profile?.latitude;
      const lng = currentLocation?.longitude ?? profile?.longitude;
      if (lat != null && lng != null) {
        context.latitude = lat;
        context.longitude = lng;
      }
      if (profile?.budgetMax != null) {
        context.budget = profile.budgetMax;
      }
      const run = await sendConversationMessage(conversationId, text, context, key);
      setMessages((current) => [
        ...current,
        {
          id: `local:${key}`,
          role: "USER",
          text,
          createdAt: new Date().toISOString(),
        },
      ]);
      setInput("");
      await followRun(run.id);
    } catch {
      setChatError("AI chưa thể trả lời lúc này. Nội dung vẫn được giữ để bạn thử lại.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row h-full w-full p-0 xl:p-6 xl:pt-2 gap-0 xl:gap-6 overflow-hidden relative bg-[#f8f9fa]">

      {/* Left Chat Area (Main Concierge Conversation) */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-white xl:rounded-3xl shadow-sm border-x-0 xl:border border-gray-100 overflow-hidden relative">

        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 p-3 lg:p-4 border-b border-blue-100 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-[20px] lg:text-[22px]">smart_toy</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-[14px] lg:text-[16px] text-gray-900 leading-tight flex items-center gap-2">
                <span>EatWise AI Concierge</span>
                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[9px] font-bold uppercase tracking-wider">
                  REAL API
                </span>
              </h2>
              <p className="text-[10px] lg:text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                Tư vấn thực đơn cá nhân hóa • Tự động lọc dị ứng 3 tầng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewConversation}
              disabled={sending}
              className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span className="hidden sm:inline">Hội thoại mới</span>
            </button>
          </div>
        </div>

        {/* Chat Messages Log */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-4">
          <div className="text-center my-1">
            <span className="bg-gray-50 border border-gray-100 px-3 py-1 rounded-full text-[10px] font-bold text-gray-400">
              {conversationId
                ? `Phiên hội thoại #${conversationId.slice(0, 8).toUpperCase()} đồng bộ trực tiếp từ backend`
                : "Đang kết nối tới AI..."}
            </span>
          </div>

          {/* Intro AI Welcome if conversation is fresh */}
          {messages.length === 0 && !loadingHistory && (
            <div className="max-w-md mx-auto my-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
                <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
              </div>
              <h3 className="font-black text-base text-gray-900 mb-1">
                Xin chào! Bạn muốn ăn gì hôm nay?
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Hãy nhập câu hỏi bất kỳ. Nội dung của bạn sẽ được gửi trực tiếp tới mô hình AI qua backend và câu trả lời được truyền về theo thời gian thực.
              </p>
            </div>
          )}

          {/* Render real conversation messages */}
          {messages.map((message) =>
            message.role === "USER" ? (
              <div key={message.id} className="flex flex-col items-end w-full">
                <span className="text-[10px] font-bold text-gray-400 mb-1 mr-2">Bạn</span>
                <div className="bg-[#ff7b00] text-white rounded-2xl rounded-tr-sm p-3.5 max-w-[85%] sm:max-w-[75%] shadow-sm">
                  <p className="text-xs sm:text-[13px] leading-relaxed font-medium whitespace-pre-wrap">
                    {message.text}
                  </p>
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex flex-col items-start w-full">
                <div className="flex items-center gap-1.5 mb-1 ml-2">
                  <span className="text-[10px] font-extrabold text-blue-600 flex items-center gap-1">
                    EatWise AI
                    <span className="material-symbols-outlined text-xs">verified</span>
                  </span>
                </div>
                <div className="flex gap-2.5 max-w-[90%] sm:max-w-[80%]">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-200 mt-0.5">
                    <span className="material-symbols-outlined text-sm">smart_toy</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm p-3.5 shadow-sm text-xs sm:text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {message.text}
                    {message.results && message.results.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigate("map")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-bold hover:bg-orange-100 transition"
                        >
                          <span className="material-symbols-outlined text-xs">map</span>
                          <span>Xem trên Bản đồ quán</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}

          {/* Streaming status spinner */}
          {sending && (
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 ml-2 animate-pulse">
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
              <span>EatWise AI đang phân tích dữ liệu món & quán...</span>
            </div>
          )}

          {chatError && (
            <p role="alert" className="mx-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {chatError}
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 lg:p-4 bg-white border-t border-gray-100 shrink-0 pb-[70px] lg:pb-4">
          {/* Message input */}
          <div className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Nhập câu hỏi bất kỳ cho AI Concierge..."
              className="w-full h-11 bg-gray-50 rounded-2xl pl-4 pr-12 text-xs font-medium text-gray-800 outline-none border border-gray-200 focus:border-blue-500 focus:bg-white transition"
            />
            <button
              onClick={() => send()}
              disabled={sending || !conversationId || !input.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition shadow-sm"
            >
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </div>
        </div>

      </div>

      {/* Right Column: AI Taste Profile Context & Live Policy Status (Desktop 320px) */}
      <div className="w-full xl:w-[340px] shrink-0 h-auto xl:h-full overflow-y-auto flex flex-col gap-4 p-4 xl:p-0">
        
        {/* User Role & AI Access Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <span className="material-symbols-outlined text-base">verified_user</span>
            </span>
            <div>
              <h3 className="font-black text-xs text-gray-900 uppercase tracking-wider">
                Quyền Truy Cập AI
              </h3>
              <p className="text-[10px] text-emerald-600 font-bold">Mở khóa toàn bộ cho mọi tài khoản</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Tài khoản:</span>
              <span className="font-bold text-gray-900 truncate max-w-[170px]">{user?.displayName || "Người dùng"}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Vai trò:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700">
                {user?.role === "ADMIN" ? "Quản trị viên (ADMIN)" : "Thành viên (USER)"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Vị trí AI:</span>
              <span className="font-bold text-gray-800 text-[11px] truncate max-w-[160px]">
                {currentLocation ? `GPS ${currentLocation.latitude.toFixed(2)}, ${currentLocation.longitude.toFixed(2)}` : (profile?.areaLabel || "Chưa lưu")}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500 font-medium">Hạn mức ngân sách:</span>
              <span className="font-bold text-[#ff7b00]">
                {profile?.budgetMax ? `${profile.budgetMax.toLocaleString("vi-VN")}đ` : "70.000đ"}
              </span>
            </div>
          </div>
        </div>

        {/* Taste Safety Enforcement Panel */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-base">security</span>
            </span>
            <div>
              <h3 className="font-black text-xs text-gray-900 uppercase tracking-wider">
                Ràng Buộc An Toàn AI
              </h3>
              <p className="text-[10px] text-gray-400">Kiểm duyệt tự động qua Fastify</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">
                verified
              </span>
              <div>
                <h4 className="font-extrabold text-xs text-emerald-900">
                  Kiểm duyệt 3 tầng
                </h4>
                <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                  AI chỉ đề xuất món và quán đã vượt qua bộ lọc dị ứng và an toàn vệ sinh.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-100 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#ff7b00] text-base shrink-0 mt-0.5">
                history
              </span>
              <div>
                <h4 className="font-extrabold text-xs text-orange-900">
                  Luật Cooldown 96 giờ
                </h4>
                <p className="text-[11px] text-orange-800 leading-snug mt-0.5">
                  Các món bạn đã chọn hoặc đã ăn gần đây sẽ tự động được cách ly khỏi danh sách gợi ý.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Transparency Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <span className="material-symbols-outlined text-base">info</span>
            </span>
            <div>
              <h3 className="font-black text-xs text-gray-900 uppercase tracking-wider">
                Khả Năng Hỗ Trợ
              </h3>
              <p className="text-[10px] text-gray-400">Phạm vi hoạt động thực tế</p>
            </div>
          </div>

          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
              <span>Gợi ý thực đơn cá nhân hóa theo bữa</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
              <span>Tìm quán quanh tọa độ thực tế</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
              <span>Dẫn đường trực tiếp qua Google Maps</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
              <span>Công thức món tự nấu tại nhà</span>
            </li>
            <li className="flex items-center gap-2 text-gray-400">
              <span className="material-symbols-outlined text-amber-500 text-base">schedule</span>
              <span>Đặt hàng & Giao món (Coming Soon)</span>
            </li>
          </ul>
        </div>

        {/* Quick Tips */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-5 border border-gray-200/60 text-xs text-gray-600">
          <h4 className="font-extrabold text-gray-900 mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-500 text-base">tips_and_updates</span>
            <span>Mẹo tương tác với AI</span>
          </h4>
          <p className="leading-relaxed">
            Bạn có thể nói rõ cảm giác thèm ăn (ví dụ: "Muốn ăn gì đó chua cay ấm nóng", "Hôm nay hơi mệt muốn ăn cháo") để AI tìm món phù hợp nhất!
          </p>
        </div>

      </div>

    </div>
  );
}
