import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import FeedbackControls from "./FeedbackControls";
import { money } from "./foodUtils";
import PlacePhoto from "./PlacePhoto";
import { sourceNames } from "./Discovery";
import UserNotice from "./UserNotice";

export default function NearbyFood({
  onCandidates,
  notice,
  onRestaurant,
  context,
}) {
  const [budget, setBudget] = useState("50000");
  const [radius, setRadius] = useState("3500");
  const [location, setLocation] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allowUnknown, setAllowUnknown] = useState(false);
  const [saving, setSaving] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [saveLocation, setSaveLocation] = useState(false);
  const initialized = useRef(false),
    automatic = useRef(null),
    requestKey = useRef(null);
  const pending = useRef(new Map());
  const generation = useRef(0);
  useEffect(() => {
    if (!context?.enabled) return;
    if (!initialized.current) {
      initialized.current = true;
      setBudget(String(context.budget));
      setRadius(String(context.radius));
      setOnlyOpen(context.onlyOpen);
      if (context.latitude != null && context.longitude != null)
        setLocation({
          latitude: context.latitude,
          longitude: context.longitude,
        });
    }
    const autoSignature = `${context.profileRevision ?? 0}:${context.latitude}:${context.longitude}`;
    if (!context.personalizedReady && automatic.current) {
      generation.current++;
      setData(null);
      setBusy(false);
      automatic.current = null;
    }
    if (
      automatic.current !== autoSignature &&
      context.personalizedReady &&
      context.latitude != null &&
      context.longitude != null
    ) {
      automatic.current = autoSignature;
      search(null, context);
    }
  }, [context]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    const chosen = (event) =>
      setData((old) =>
        old
          ? {
              ...old,
              items: old.items.filter(
                (item) =>
                  (!event.detail?.dishId ||
                    item.dishId !== event.detail.dishId) &&
                  (!event.detail?.canonicalName ||
                    (item.canonicalName !== event.detail.canonicalName &&
                      !item.canonicalAliases?.includes(
                        event.detail.canonicalName,
                      ))),
              ),
            }
          : old,
      );
    window.addEventListener("food-choice-saved", chosen);
    return () => window.removeEventListener("food-choice-saved", chosen);
  }, []);
  useEffect(() => {
    const confirmed = (data?.items || [])
      .filter(
        (item) => !item.expiresAt || Date.parse(item.expiresAt) > Date.now(),
      )
      .map((item) => ({
        ...item,
        kind: "DISH",
        recommendationRequestId: data?.id,
      }));
    const unknown = allowUnknown
      ? (data?.restaurants || [])
          .filter((place) => place.openNow !== false)
          .map((place) => ({
            ...place,
            id: `${place.source}:${place.placeId}`,
            kind: "RESTAURANT",
            title: place.name,
            restaurantName: place.name,
            budgetVerified: false,
          }))
      : [];
    onCandidates([...confirmed, ...unknown].slice(0, 8));
  }, [data, allowUnknown, onCandidates]);
  const gps = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation)
        return reject(new Error("Trình duyệt không hỗ trợ vị trí hiện tại."));
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        (err) =>
          reject(
            new Error(
              err.code === 1
                ? "Bạn chưa cho phép truy cập vị trí. Mở quyền vị trí trong trình duyệt rồi bấm tìm lại."
                : err.code === 3
                  ? "Lấy vị trí mất quá lâu. Kiểm tra GPS và kết nối rồi bấm tìm lại."
                  : "Chưa xác định được vị trí. Kiểm tra GPS rồi bấm tìm lại.",
            ),
          ),
        { timeout: 10000, maximumAge: 60000 },
      );
    });
  const search = async (event, initial) => {
    event?.preventDefault();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setData(null);
    setAllowUnknown(false);
    const activeBudget = String(initial?.budget ?? budget),
      activeRadius = String(initial?.radius ?? radius),
      activeOnlyOpen = initial?.onlyOpen ?? onlyOpen;
    const fetchNearby = async (point) => {
      if (context?.enabled && context.personalizedReady) {
        const input = {
          budget: Number(activeBudget),
          radius: Number(activeRadius),
          onlyOpen: activeOnlyOpen,
          ...(point ? point : {}),
        };
        const fingerprint = JSON.stringify({
          ...input,
          profileRevision:
            initial?.profileRevision ?? context?.profileRevision ?? 0,
        });
        if (requestKey.current?.fingerprint !== fingerprint)
          requestKey.current = { fingerprint, key: crypto.randomUUID() };
        const submittedKey = requestKey.current.key;
        const response = await apiRequest("/recommendations", {
          method: "POST",
          body: JSON.stringify({
            ...input,
            idempotencyKey: submittedKey,
          }),
        });
        if (requestKey.current?.key === submittedKey) requestKey.current = null;
        return {
          data: {
            ...response.data,
            restaurants: response.data.restaurants || [],
            notice:
              "Giá lấy từ thực đơn được cấp quyền còn hạn. Ảnh và đánh giá thuộc quán. Hãy xác nhận nguyên liệu và thời gian mở cửa trước khi đến.",
          },
        };
      }
      const params = new URLSearchParams({
        budget: activeBudget,
        radius: activeRadius,
        onlyOpen: String(activeOnlyOpen),
      });
      if (point) {
        params.set("latitude", String(point.latitude));
        params.set("longitude", String(point.longitude));
      }
      return apiRequest(`/discovery/nearby-food?${params}`);
    };
    try {
      if (context?.enabled && !initial) {
        await apiRequest("/users/me/discovery-settings", {
          method: "PUT",
          body: JSON.stringify({
            budget: Number(activeBudget),
            radius: Number(activeRadius),
            onlyOpen: activeOnlyOpen,
            ...(saveLocation && location ? location : {}),
          }),
        });
      }
      let response;
      try {
        response = await fetchNearby(
          initial
            ? { latitude: initial.latitude, longitude: initial.longitude }
            : location,
        );
      } catch (err) {
        if (err.code !== "LOCATION_REQUIRED") throw err;
        const point = await gps();
        if (current !== generation.current) return;
        setLocation(point);
        if (context?.enabled && saveLocation)
          await apiRequest("/users/me/discovery-settings", {
            method: "PUT",
            body: JSON.stringify({
              budget: Number(activeBudget),
              radius: Number(activeRadius),
              onlyOpen: activeOnlyOpen,
              ...point,
            }),
          });
        response = await fetchNearby(point);
      }
      if (current === generation.current) setData(response.data);
    } catch (err) {
      if (current === generation.current) setError(err.message);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const choose = async (item) => {
    setSaving(item.id);
    setError("");
    if (!pending.current.has(item.dishId))
      pending.current.set(item.dishId, crypto.randomUUID());
    try {
      const resultFeedback = item.offerId && data?.id;
      await apiRequest(
        resultFeedback
          ? `/recommendations/${data.id}/feedback`
          : `/users/me/dishes/${item.dishId}/interactions`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "CHOSEN",
            idempotencyKey: pending.current.get(item.dishId),
            ...(resultFeedback ? { resultId: item.id } : {}),
          }),
        },
      );
      pending.current.delete(item.dishId);
      window.dispatchEvent(
        new CustomEvent("food-choice-saved", {
          detail: { dishId: item.dishId },
        }),
      );
      notice("Đã chọn món. Món này được ẩn khỏi gợi ý trong 4 ngày.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  };
  return (
    <section className="food-nearby" aria-label="Khám phá món quanh bạn">
      <p className="food-eyebrow">ĂN NGON QUANH BẠN</p>
      <h2>Hôm nay bạn muốn chi bao nhiêu?</h2>
      <p>
        Tìm món và quán trong 3–4 km. Chưa biết chọn gì? Thử vòng quay ở góc màn
        hình.
      </p>
      <form className="food-nearby-form" onSubmit={search}>
        <label htmlFor="nearby-budget">
          Ngân sách mỗi người (đ)
          <input
            id="nearby-budget"
            type="number"
            min={1000}
            max={100000000}
            step={1000}
            required
            disabled={busy}
            value={budget}
            onChange={(event) => {
              setBudget(event.target.value);
              setData(null);
            }}
          />
        </label>
        {context?.enabled && (
          <label>
            <input
              type="checkbox"
              checked={onlyOpen}
              disabled={busy}
              onChange={(event) => {
                setOnlyOpen(event.target.checked);
                setData(null);
              }}
            />{" "}
            Chỉ quán xác nhận đang mở
          </label>
        )}
        <label>
          Bán kính
          <select
            disabled={busy}
            value={radius}
            onChange={(event) => {
              setRadius(event.target.value);
              setData(null);
            }}
          >
            {[3000, 3500, 4000].map((value) => (
              <option value={value} key={value}>
                {value / 1000} km
              </option>
            ))}
          </select>
        </label>
        <button className="food-primary" disabled={busy}>
          {busy ? "Đang tìm quanh bạn…" : "Tìm món quanh tôi"}
        </button>
      </form>
      {context?.enabled && (
        <label>
          <input
            type="checkbox"
            checked={saveLocation}
            onChange={(event) => setSaveLocation(event.target.checked)}
          />{" "}
          Lưu vị trí này vào tài khoản cho lần mở app tiếp theo
        </label>
      )}
      {context?.enabled && !location && (
        <UserNotice>
          Cho phép vị trí bằng nút “Tìm món quanh tôi”. App không tự xin GPS mỗi
          lần tải màn hình.
        </UserNotice>
      )}
      <p className="food-muted">
        {location
          ? "Đang dùng vị trí GPS hiện tại."
          : "Dùng vị trí đã lưu; nếu chưa có, app sẽ xin vị trí hiện tại."}
      </p>
      {location && (
        <button
          disabled={busy}
          onClick={async () => {
            try {
              setLocation(await gps());
              setData(null);
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          Cập nhật vị trí hiện tại
        </button>
      )}
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="food-muted">{data.notice}</p>
          {data.rankingStatus?.startsWith("FALLBACK") && (
            <UserNotice tone="warning">
              AI xếp hạng tạm thời chưa sẵn sàng. Kết quả vẫn được lọc theo điều
              kiện đã lưu và xếp hạng bằng hệ thống mặc định.
            </UserNotice>
          )}
          {data.status === "NO_SAFE_MATCH" && (
            <UserNotice
              tone="warning"
              title="Chưa đủ bằng chứng cho ràng buộc ăn uống"
            >
              Không có món đáp ứng đầy đủ bằng chứng dị ứng/chế độ ăn đã lưu. Bộ
              lọc được giữ nguyên; hãy liên hệ quán để xác nhận hoặc tìm công
              thức phù hợp.
            </UserNotice>
          )}
          {data.sources
            ?.filter(
              (source) => !["OK", "NOT_CONFIGURED"].includes(source.status),
            )
            .map((source) => (
              <UserNotice key={source.source} tone="warning">
                {sourceNames[source.source] || "Một nguồn dữ liệu"} tạm thời
                chưa trả được kết quả. Danh sách hiện tại có thể chưa đầy đủ;
                bạn có thể thử tìm lại sau.
              </UserNotice>
            ))}
          {data.items.length > 0 && (
            <>
              <h3>Món có giá xác nhận, tối đa {money(data.budget)}</h3>
              <div className="food-grid">
                {data.items.map((item) => (
                  <article className="food-card" key={item.id}>
                    <PlacePhoto photo={item.photo} name={item.restaurantName} />
                    <h3>{item.title}</h3>
                    <p>{item.restaurantName}</p>
                    {item.reason && (
                      <p className="food-reason">{item.reason}</p>
                    )}
                    {item.warnings?.includes("OPENING_UNCONFIRMED") && (
                      <p className="food-muted">
                        Chưa xác nhận giờ mở cửa. Hãy liên hệ quán trước khi
                        đến.
                      </p>
                    )}
                    <strong>{money(item.price)}</strong>
                    <p>
                      {(item.distanceMeters / 1000).toFixed(1)} km ·{" "}
                      {item.rating == null
                        ? "Chưa có đánh giá"
                        : `${item.rating}/5 (${item.ratingCount || 0} đánh giá quán)`}
                    </p>
                    <p>{item.address}</p>
                    {item.offerId && data.id && (
                      <FeedbackControls
                        path={`/recommendations/${data.id}/feedback`}
                        resultId={item.id}
                        dishId={item.dishId}
                        canonicalName={item.canonicalName}
                        onSaved={(type) => {
                          if (type === "SKIPPED")
                            setData((old) =>
                              old
                                ? {
                                    ...old,
                                    items: old.items.filter(
                                      (row) => row.dishId !== item.dishId,
                                    ),
                                  }
                                : old,
                            );
                        }}
                      />
                    )}
                    <div className="food-actions">
                      <button
                        className="food-primary"
                        disabled={!!saving}
                        onClick={() => choose(item)}
                      >
                        Chọn món này
                      </button>
                      <button onClick={() => onRestaurant(item)}>
                        Chi tiết quán / thực đơn
                      </button>
                      <a href={item.mapsUrl} target="_blank" rel="noreferrer">
                        Xem quán ↗
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {!data.items.length && data.status === "SUCCESS" && (
            <p>
              Chưa có món được xác nhận giá trong ngân sách này. Các quán dưới
              đây cần kiểm tra thực đơn và giá trước khi chọn.
            </p>
          )}
          {data.status === "NOT_CONFIGURED" && (
            <p role="status">
              Nguồn quán chưa được kết nối. Kết quả thật sẽ xuất hiện khi nguồn
              được thiết lập.
            </p>
          )}
          {data.status === "UNAVAILABLE" && (
            <p role="status">
              Nguồn quán tạm thời không khả dụng. Hãy thử lại sau.
            </p>
          )}
          {data.status === "SUCCESS" &&
            !data.items.length &&
            !data.restaurants.length && (
              <p>Chưa có kết quả trong bán kính này. Thử bán kính 4 km.</p>
            )}
          {data.restaurants.length > 0 && (
            <>
              <h3>Quán quanh bạn · giá món chưa xác nhận</h3>
              <UserNotice tone="warning" title="Cần kiểm tra thực đơn với quán">
                Danh sách này chưa xác nhận món đang bán hoặc giá trong ngân
                sách. Ảnh và đánh giá là của quán; hãy hỏi giá, nguyên liệu và
                dị ứng trước khi chọn.
              </UserNotice>
              <label className="food-check-option">
                <input
                  type="checkbox"
                  checked={allowUnknown}
                  onChange={(event) => setAllowUnknown(event.target.checked)}
                />
                Cho phép vòng quay chọn quán chưa có giá món
              </label>
              <div className="food-grid">
                {data.restaurants.map((place) => (
                  <article
                    className="food-card"
                    key={`${place.source}:${place.placeId}`}
                  >
                    <PlacePhoto photo={place.photo} name={place.name} />
                    <p className="food-eyebrow">{sourceNames[place.source]}</p>
                    <button onClick={() => onRestaurant(place)}>
                      Chi tiết quán / thực đơn
                    </button>
                    <h3>{place.name}</h3>
                    <p>
                      {(place.distanceMeters / 1000).toFixed(1)} km ·{" "}
                      {place.rating == null
                        ? "Nguồn chưa cung cấp đánh giá"
                        : `${place.rating}/5 (${place.ratingCount ?? 0} đánh giá quán)`}
                    </p>
                    <p>{place.address}</p>
                    <p>
                      {place.openNow === true
                        ? "Đang mở cửa"
                        : place.openNow === false
                          ? "Đang đóng cửa"
                          : "Chưa rõ giờ mở cửa"}{" "}
                      · Chưa xác nhận giá món
                    </p>
                    {place.mapsUrl && (
                      <a href={place.mapsUrl} target="_blank" rel="noreferrer">
                        Xem quán & chỉ đường ↗
                      </a>
                    )}
                    {place.attributions.map((author, i) => (
                      <small key={i}>
                        {author.providerUri ? (
                          <a
                            href={author.providerUri}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {author.provider}
                          </a>
                        ) : (
                          author.provider
                        )}
                      </small>
                    ))}
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
