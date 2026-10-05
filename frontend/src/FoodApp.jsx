import { useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY, apiRequest, getAccessToken } from "./profileApi";
import "./food.css";
import Auth from "./features/food/Auth";
import Today from "./features/food/Today";
import DishDetail from "./features/food/DishDetail";
import Onboarding from "./features/food/Onboarding";
import History from "./features/food/History";
import PublicLegal from "./features/food/PublicLegal";

export default function FoodApp() {
  const [signedIn, setSignedIn] = useState(Boolean(getAccessToken()));
  const [screen, setScreen] = useState(() =>
    ["profile", "history", "terms", "privacy"].includes(
      window.location.hash.slice(1),
    )
      ? window.location.hash.slice(1)
      : "today",
  );
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const expire = () => setSignedIn(false);
    window.addEventListener("food-session-expired", expire);
    return () => window.removeEventListener("food-session-expired", expire);
  }, []);
  useEffect(() => {
    const sync = () =>
      setScreen(
        ["today", "profile", "history", "dish", "terms", "privacy"].includes(
          window.location.hash.slice(1),
        )
          ? window.location.hash.slice(1)
          : "today",
      );
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const notice = (text) => setMessage(text);
  const navigate = (next) => {
    setMessage("");
    setScreen(next);
    window.location.hash = next;
  };
  if (!signedIn)
    return (
      <div className="food-shell">
        {screen === "terms" || screen === "privacy" ? (
          <main className="food-main">
            <button onClick={() => navigate("today")}>← Đăng nhập</button>
            <PublicLegal screen={screen} />
          </main>
        ) : (
          <Auth
            onLogin={() => {
              setSignedIn(true);
              navigate("today");
            }}
          />
        )}
        <footer className="food-legal">
          <a href="#terms">Điều khoản</a> ·{" "}
          <a href="#privacy">Quyền riêng tư</a>
        </footer>
      </div>
    );
  return (
    <div className="food-shell">
      <header className="food-header">
        <button className="food-brand" onClick={() => navigate("today")}>
          EatWise <span>Ăn ngon, đúng gu</span>
        </button>
        <button
          onClick={async () => {
            try {
              await apiRequest("/auth/logout", {
                method: "POST",
                body: JSON.stringify({
                  refreshToken:
                    sessionStorage.getItem("food_refresh_token") || "",
                }),
              });
            } catch {
              /* Clear local session even when server is offline. */
            }
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            sessionStorage.removeItem("food_refresh_token");
            setSignedIn(false);
          }}
        >
          Đăng xuất
        </button>
      </header>
      <main className="food-main">
        {message && (
          <p className="food-notice" role="status">
            {message}
          </p>
        )}
        {screen === "today" && (
          <Today
            navigate={navigate}
            onDish={(dish) => {
              setSelected(dish);
              navigate("dish");
            }}
            notice={notice}
          />
        )}
        {screen === "profile" && (
          <Onboarding
            onSaved={() => {
              navigate("today");
              notice(
                "Đã lưu hồ sơ. Gợi ý được cập nhật theo lựa chọn của bạn.",
              );
            }}
          />
        )}
        {screen === "history" && <History />}
        {screen === "dish" && selected && (
          <DishDetail
            dish={selected}
            notice={notice}
            onBack={() => navigate("today")}
          />
        )}
      </main>
      <nav className="food-nav" aria-label="Điều hướng chính">
        {[
          ["today", "Hôm nay"],
          ["history", "Đã chọn / đã ăn"],
          ["profile", "Khẩu vị của tôi"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={screen === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <footer className="food-legal">
        <a
          href="#terms"
          onClick={(e) => {
            e.preventDefault();
            navigate("terms");
          }}
        >
          Điều khoản
        </a>{" "}
        ·{" "}
        <a
          href="#privacy"
          onClick={(e) => {
            e.preventDefault();
            navigate("privacy");
          }}
        >
          Quyền riêng tư
        </a>
      </footer>
      {screen === "terms" && (
        <section className="food-main">
          <PublicLegal screen={screen} />
        </section>
      )}
      {screen === "privacy" && (
        <section className="food-main">
          <PublicLegal screen={screen} />
        </section>
      )}
    </div>
  );
}
