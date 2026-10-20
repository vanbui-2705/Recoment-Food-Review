import { useEffect, useMemo, useRef, useState } from "react";
import {
  createIdempotencyKey,
  fetchHistory,
  recordHistoryFeedback,
} from "../dashboardApi.js";
import { historyInteractionToView } from "../dashboardAdapters.js";

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const statusText = (type) =>
  type === "EATEN" ? "Đã ăn" : "Đã chọn";

export default function HistoryPage() {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(() => new Set());
  const feedbackLocks = useRef(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    const load = async () => {
      const collected = [];
      let cursor;
      let page = 0;
      do {
        const payload = await fetchHistory({
          limit: 50,
          ...(cursor ? { cursor } : {}),
          ...(filter === "chosen" ? { type: "CHOSEN" } : {}),
          ...(filter === "eaten" ? { type: "EATEN" } : {}),
        });
        collected.push(...(payload?.items || []));
        cursor = payload?.nextCursor || null;
        page += 1;
      } while (active && cursor && page < 20);
      if (active) {
        setItems(collected.map(historyInteractionToView).filter(Boolean));
      }
    };
    load()
      .catch(() => {
        if (active) {
          setItems([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter]);

  const latest = items[0] || null;
  const counts = useMemo(
    () => ({
      chosen: items.filter((item) => item.interactionType === "CHOSEN").length,
      eaten: items.filter((item) => item.interactionType === "EATEN").length,
    }),
    [items],
  );

  const like = async (item) => {
    if (!item?.id || feedbackLocks.current.has(item.id)) return;
    feedbackLocks.current.add(item.id);
    setPendingFeedback((current) => new Set(current).add(item.id));
    try {
      await recordHistoryFeedback(
        item.kind,
        item.id,
        "LIKED",
        createIdempotencyKey(),
      );
    } catch {
      // Do not show success; unlock the action so it can be retried.
    } finally {
      feedbackLocks.current.delete(item.id);
      setPendingFeedback((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4 lg:p-6 lg:pt-2 bg-[#f8f9fa]">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-orange-50 text-[#ff7b00] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              </span>
              <h1 className="text-xl font-extrabold text-gray-900">Lịch Sử Tương Tác Món Ăn</h1>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-1">
              Dữ liệu đã chọn và đã ăn được đồng bộ trực tiếp từ tài khoản của bạn
            </p>
          </div>

          <div className="flex gap-2">
            {["all", "chosen", "eaten"].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filter === type ? "bg-[#ff7b00] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {type === "all" ? "Tất cả" : type === "chosen" ? "Đã chọn" : "Đã ăn"}
              </button>
            ))}
          </div>
        </div>

        {latest && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl p-6 border border-orange-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
                <span className="font-extrabold text-xs text-green-700 uppercase tracking-wider">Tương tác gần nhất</span>
              </div>
              <span className="font-bold text-xs text-gray-400">{formatTime(latest.createdAt)}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-2xl bg-white text-[#ff7b00] shadow-sm shrink-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]">restaurant</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">{latest.title}</h3>
                  <p className="text-xs text-gray-600 font-medium">{latest.kind === "RECIPE" ? "Công thức nấu ăn" : "Món trong danh mục"}</p>
                  <p className="text-xs text-[#ff7b00] font-bold mt-1">{statusText(latest.interactionType)}</p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => like(latest)}
                  disabled={pendingFeedback.has(latest.id)}
                  className="px-4 py-2.5 bg-[#ff7b00] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#e66a00] flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                >
                  <span className="material-symbols-outlined text-[16px]">favorite</span>
                  Yêu thích
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider px-1">
            {loading ? "Đang tải lịch sử" : `${items.length} tương tác • ${counts.chosen} đã chọn • ${counts.eaten} đã ăn`}
          </h2>

          {!loading && loadError && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center text-sm font-medium text-red-500">
              Không thể tải lịch sử tương tác. Vui lòng thử lại.
            </div>
          )}

          {!loading && !loadError && items.length === 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center text-sm font-medium text-gray-400">
              Chưa có tương tác phù hợp với bộ lọc này.
            </div>
          )}

          {items.map((item) => (
            <div key={`${item.kind}:${item.id}`} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-gray-200 transition-all">
              <div className="flex gap-4 items-center min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#ff7b00] shrink-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">{item.kind === "RECIPE" ? "menu_book" : "restaurant"}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-extrabold text-sm text-gray-900 truncate">{item.title}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{item.kind}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{item.source ? `Nguồn: ${item.source}` : "Dữ liệu món ăn EatWise"}</p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1 font-medium">
                    <span>{formatTime(item.createdAt)}</span>
                    {item.appRating && <><span>•</span><span className="font-bold text-gray-700">{item.appRating}/5 sao</span></>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${item.interactionType === "CHOSEN" ? "bg-orange-100 text-[#ff7b00]" : "bg-emerald-50 text-emerald-700"}`}>
                  {statusText(item.interactionType)}
                </span>
                <button
                  onClick={() => like(item)}
                  disabled={pendingFeedback.has(item.id)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
                >
                  Yêu thích
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
