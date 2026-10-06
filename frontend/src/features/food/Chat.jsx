import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { userErrorMessage } from "../../userMessages";
import { date } from "./foodUtils";

export default function Chat({ onRecipe, onRestaurant }) {
  const [conversations, setConversations] = useState([]),
    [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]),
    [runs, setRuns] = useState([]),
    [cards, setCards] = useState([]);
  const [text, setText] = useState(""),
    [budget, setBudget] = useState(""),
    [location, setLocation] = useState(null);
  const [configured, setConfigured] = useState(null),
    [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false),
    [runId, setRunId] = useState(null);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const stream = useRef(null),
    current = useRef(null),
    sequence = useRef(0),
    retryKey = useRef(null),
    dialog = useRef(null);
  useEffect(() => {
    loadList(1);
    return () => {
      current.current = null;
      stream.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (deleteTarget) dialog.current?.showModal();
  }, [deleteTarget]);
  async function loadList(next) {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiRequest(`/conversations?page=${next}`);
      setConfigured(data.configured);
      setConversations((old) =>
        next === 1 ? data.items : [...old, ...data.items],
      );
      setPage(next);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function refresh(id) {
    const { data } = await apiRequest(`/conversations/${id}`);
    if (current.current !== id) return;
    setConversation(data.conversation);
    setMessages(data.messages);
    setRuns(data.runs);
    const context = data.conversation.context || {};
    setBudget(context.budget == null ? "" : String(context.budget));
    setLocation(
      context.latitude == null
        ? null
        : { latitude: context.latitude, longitude: context.longitude },
    );
    return data;
  }
  async function select(id) {
    stream.current?.abort();
    current.current = id;
    sequence.current = 0;
    retryKey.current = null;
    setRunId(null);
    setCards([]);
    setError("");
    setText("");
    setStatus("");
    setBusy(true);
    try {
      const data = await refresh(id);
      const latest = data?.runs[0];
      if (latest) {
        setRunId(latest.id);
        connect(latest.id, id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const { data } = await apiRequest("/conversations", { method: "POST" });
      await loadList(1);
      await select(data.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function hydrate(results, id) {
    const refs = results
      .flatMap((result) => result.references || [])
      .slice(0, 8);
    const loaded = await Promise.allSettled(
      refs.map(async (ref) => {
        if (ref.kind === "RECOMMENDATION") {
          const { data } = await apiRequest(
            `/recommendations/${encodeURIComponent(ref.id)}`,
          );
          return data.items
            .filter((item) => item.currentEligible)
            .slice(0, 4)
            .map((item) => ({
              key: item.id,
              title: item.title,
              subtitle: item.restaurantName,
              href: `#restaurant/local/${item.restaurantId}`,
            }));
        }
        if (ref.kind === "RECIPE") {
          const { data } = await apiRequest(
            `/recipes/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.id)}`,
          );
          return [
            {
              key: `${ref.source}:${ref.id}`,
              title: data.recipe.title,
              subtitle:
                "Công thức từ nguồn bên ngoài; kiểm tra nguyên liệu trước khi nấu.",
              href: `#recipe/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.id)}`,
            },
          ];
        }
        if (ref.kind === "PLACE") {
          const { data } = await apiRequest(
            `/restaurants/places/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.id)}`,
          );
          return [
            {
              key: `${ref.source}:${ref.id}`,
              title: data.restaurant.name,
              subtitle:
                "Kết quả quán; chưa xác nhận giá món hoặc an toàn dị ứng.",
              href: `#restaurant/place/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.id)}`,
            },
          ];
        }
        return [];
      }),
    );
    if (current.current !== id) return;
    const found = loaded.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    setCards([...new Map(found.map((card) => [card.key, card])).values()]);
    if (
      !found.length &&
      results.some((result) => result.status === "PROFILE_PENDING_ANALYSIS")
    )
      setStatus(
        "Mô tả khẩu vị đang chờ phân tích hoặc xác nhận. Mở Khẩu vị của tôi để hoàn tất; bạn vẫn có thể tìm quán hoặc công thức chủ động.",
      );
    else if (
      !found.length &&
      results.some((result) => result.status === "ONBOARDING_REQUIRED")
    )
      setStatus(
        "Hãy nhập và hoàn tất khẩu vị của bạn để nhận gợi ý cá nhân hóa.",
      );
    else if (
      !found.length &&
      results.some((result) => result.status === "READY")
    )
      setStatus("Khẩu vị đã sẵn sàng để dùng cho gợi ý cá nhân hóa.");
    else if (
      !found.length &&
      results.some((result) => result.status === "NO_SAFE_MATCH")
    )
      setStatus(
        "Chưa tìm được món có đủ bằng chứng cho ràng buộc dị ứng hoặc chế độ ăn. Hãy đổi khu vực hoặc thời điểm tìm; các ràng buộc vẫn được giữ.",
      );
    else if (
      !found.length &&
      results.some((result) => result.status === "NO_MATCH")
    )
      setStatus(
        "Chưa có món phù hợp ngân sách và khu vực hiện tại. Bạn có thể đổi ngân sách hoặc tìm món khác.",
      );
    else if (
      !found.length &&
      results.some((result) =>
        ["NOT_CONFIGURED", "UNAVAILABLE", "PARTIAL"].includes(result.status),
      )
    )
      setStatus(
        "Nguồn dữ liệu chưa sẵn sàng. Bạn có thể thử lại hoặc dùng nguồn khác trong Tìm món / Nấu ăn.",
      );
    else if (
      !found.length &&
      refs.length &&
      loaded.every((result) => result.status === "fulfilled")
    )
      setStatus(
        "Kết quả trước không còn đủ điều kiện ở thời điểm hiện tại. Hãy tìm lại để dùng dữ liệu mới nhất.",
      );
    if (loaded.some((result) => result.status === "rejected"))
      setStatus(
        "Một số kết quả chưa tải được. Bạn có thể kết nối lại để thử tải chi tiết.",
      );
  }
  async function connect(run, id) {
    stream.current?.abort();
    const controller = new AbortController();
    stream.current = controller;
    setStatus("Đang kết nối lượt tìm món…");
    try {
      const response = await apiRequest(
        `/chat-runs/${run}/stream?after=${sequence.current}`,
        { responseType: "stream", signal: controller.signal },
      );
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        terminal = false;
      try {
        while (!controller.signal.aborted) {
          const next = await reader.read();
          if (next.done) break;
          buffer += decoder.decode(next.value, { stream: true });
          if (buffer.length > 200000)
            throw new Error("Luồng phản hồi quá lớn. Hãy kết nối lại.");
          let end;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const eventText = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const dataLine = eventText
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            const event = JSON.parse(dataLine.slice(6));
            if (current.current !== id || controller.signal.aborted) return;
            if (event.seq && event.seq <= sequence.current) continue;
            if (event.seq) sequence.current = event.seq;
            if (event.type === "STATUS")
              setStatus("Đã nhận tin nhắn. Đang tìm món…");
            if (event.type === "RESULT") {
              setStatus(event.payload.text);
              await hydrate(event.payload.results || [], id);
            }
            if (event.type === "ERROR")
              setError(userErrorMessage(event.payload.code));
            if (event.type === "DONE") {
              terminal = true;
              setRunId(null);
              await refresh(id);
              if (event.payload.status === "CANCELLED")
                setStatus("Đã hủy lượt tìm món.");
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (!terminal && !controller.signal.aborted && current.current === id)
        setStatus(
          "Kết nối đã tạm ngắt; lượt tìm vẫn tiếp tục. Bấm kết nối lại để nhận kết quả.",
        );
    } catch (e) {
      if (e.name !== "AbortError" && current.current === id)
        setError(e.message);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const context = {
      ...(budget ? { budget: Number(budget) } : {}),
      ...(location || {}),
    };
    const signature = JSON.stringify({ id: conversation.id, text, context });
    if (retryKey.current?.signature !== signature)
      retryKey.current = { signature, key: crypto.randomUUID() };
    try {
      const { data } = await apiRequest(
        `/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            text,
            context,
            idempotencyKey: retryKey.current.key,
          }),
        },
      );
      retryKey.current = null;
      setText("");
      setCards([]);
      sequence.current = 0;
      setRunId(data.id);
      await refresh(conversation.id);
      connect(data.id, conversation.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function gps() {
    if (!navigator.geolocation) {
      setError("Thiết bị chưa hỗ trợ lấy vị trí.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus("Đã lấy vị trí cho cuộc trò chuyện này.");
        setBusy(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Bạn chưa cho phép vị trí. Có thể bật quyền trong trình duyệt rồi thử lại."
            : "Chưa lấy được vị trí. Hãy thử lại.",
        );
        setBusy(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/chat-runs/${runId}/cancel`, { method: "POST" });
      stream.current?.abort();
      setRunId(null);
      setStatus("Đã hủy lượt tìm món.");
      await refresh(conversation.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/conversations/${deleteTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true }),
      });
      if (current.current === deleteTarget.id) {
        stream.current?.abort();
        current.current = null;
        setConversation(null);
        setMessages([]);
        setCards([]);
        setRunId(null);
      }
      dialog.current.close();
      setDeleteTarget(null);
      await loadList(1);
      setStatus("Đã xóa cuộc trò chuyện.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="food-eyebrow">CÙNG TÌM MÓN NGON</p>
      <h1>Trò chuyện tìm món</h1>
      <p>
        Chat dùng ngân sách, vị trí và khẩu vị của tài khoản để tìm món, quán
        hoặc cách nấu. Xem chi tiết và nguồn trước khi lựa chọn.
      </p>
      {configured === false && (
        <p role="status" className="food-notice">
          Chat chưa được kết nối AI. Bạn vẫn có thể dùng Tìm món / Nấu ăn.
        </p>
      )}
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <button type="button" onClick={create} disabled={busy || loading}>
        Cuộc trò chuyện mới
      </button>
      {loading && <p role="status">Đang tải cuộc trò chuyện…</p>}
      {!loading && !conversations.length && (
        <p>Chưa có cuộc trò chuyện. Bắt đầu với món bạn đang thèm.</p>
      )}
      <div className="food-chat-history">
        {conversations.map((item) => (
          <div key={item.id}>
            <button
              type="button"
              disabled={busy}
              aria-pressed={conversation?.id === item.id}
              onClick={() => select(item.id)}
            >
              {item.title} · {date(item.updatedAt)}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={`Xóa cuộc trò chuyện ${item.title}`}
              onClick={() => setDeleteTarget(item)}
            >
              Xóa
            </button>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => loadList(page + 1)}
        >
          Xem thêm cuộc trò chuyện
        </button>
      )}
      {error && !conversation && (
        <button type="button" disabled={loading} onClick={() => loadList(1)}>
          Tải lại cuộc trò chuyện
        </button>
      )}
      {conversation && (
        <section aria-label="Tin nhắn tìm món">
          {messages.map((message) => (
            <article className="food-place" key={message.id}>
              <strong>{message.role === "USER" ? "Bạn" : "EatWise"}</strong>
              <p className="food-chat-text">{message.content}</p>
            </article>
          ))}
          {cards.map((card) => (
            <article className="food-place" key={card.key}>
              <h2>{card.title}</h2>
              <p>{card.subtitle}</p>
              <a
                href={card.href}
                onClick={(event) => {
                  const parts = card.href.slice(1).split("/");
                  if (parts[0] === "recipe" && onRecipe) {
                    event.preventDefault();
                    onRecipe({
                      source: decodeURIComponent(parts[1]),
                      id: decodeURIComponent(parts[2]),
                    });
                  } else if (onRestaurant) {
                    event.preventDefault();
                    onRestaurant(
                      parts[1] === "local"
                        ? { restaurantId: parts[2] }
                        : {
                            source: parts[2],
                            placeId: decodeURIComponent(parts[3]),
                          },
                    );
                  }
                }}
              >
                Mở chi tiết
              </a>
            </article>
          ))}
          {runId && (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => connect(runId, conversation.id)}
              >
                Kết nối lại lượt tìm
              </button>
              <button type="button" disabled={busy} onClick={cancel}>
                Hủy lượt tìm
              </button>
            </div>
          )}
          {!runId && runs[0]?.status === "FAILED" && (
            <p className="food-notice">
              Lượt trước chưa hoàn thành. Nội dung còn trong nhật ký; bạn có thể
              gửi câu hỏi lại.
            </p>
          )}
          <form onSubmit={submit}>
            <label>
              Ngân sách cho một món (đồng)
              <input
                type="number"
                min="1000"
                max="100000000"
                step="1000"
                value={budget}
                disabled={busy || !!runId}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <button type="button" disabled={busy || !!runId} onClick={gps}>
              {location ? "Cập nhật vị trí" : "Lấy vị trí tìm quán"}
            </button>
            <label>
              Bạn muốn ăn gì?
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={4000}
                required
                disabled={busy || !!runId}
                placeholder="Tìm phở bò gần tôi, hoặc chỉ cách nấu món này…"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !!runId || configured !== true || !text.trim()}
            >
              {busy ? "Đang gửi…" : "Gửi câu hỏi"}
            </button>
          </form>
        </section>
      )}
      <dialog
        className="food-wheel-dialog"
        ref={dialog}
        aria-labelledby="chat-delete-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) {
            dialog.current.close();
            setDeleteTarget(null);
          }
        }}
      >
        <h2 id="chat-delete-title">Xóa cuộc trò chuyện?</h2>
        <p>
          Tin nhắn và kết quả chat sẽ bị xóa; lượt đang chạy sẽ dừng ghi kết
          quả. Thao tác không thể hoàn tác.
        </p>
        {error && (
          <p role="alert" className="food-error">
            {error}
          </p>
        )}
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={() => {
            dialog.current.close();
            setDeleteTarget(null);
          }}
        >
          Giữ cuộc trò chuyện
        </button>
        <button type="button" disabled={busy} onClick={remove}>
          Xác nhận xóa cuộc trò chuyện
        </button>
      </dialog>
    </>
  );
}
