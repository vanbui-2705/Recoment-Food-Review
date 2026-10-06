import { useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY, apiRequest, getAccessToken } from "./profileApi";
import "./food.css";
import Auth from "./features/food/Auth";
import Today from "./features/food/Today";
import DishDetail from "./features/food/DishDetail";
import Onboarding from "./features/food/Onboarding";
import History from "./features/food/History";
import PublicLegal from "./features/food/PublicLegal";
import Discovery from "./features/food/Discovery";
import RecipeDetail from "./features/food/RecipeDetail";
import LuckyWheel from "./features/food/LuckyWheel";
import UserNotice from "./features/food/UserNotice";
import AdminMenu from "./features/food/AdminMenu";
import RestaurantDetail, {
  restaurantTarget,
} from "./features/food/RestaurantDetail";

const readScreen = () => {
  const name = window.location.hash.slice(1).split("/")[0];
  if (name === "restaurant" && !restaurantTarget()) return "discover";
  return [
    "today",
    "profile",
    "history",
    "dish",
    "terms",
    "privacy",
    "discover",
    "recipe",
    "restaurant",
    "admin",
  ].includes(name)
    ? name
    : "today";
};
const readRecipe = () => {
  const [screen, source, id] = window.location.hash.slice(1).split("/");
  return screen === "recipe" &&
    ["themealdb", "spoonacular"].includes(source) &&
    /^[0-9]{1,20}$/.test(id || "")
    ? { source, id, title: "Công thức đang tải" }
    : null;
};

export default function FoodApp() {
  const [signedIn, setSignedIn] = useState(Boolean(getAccessToken()));
  const [screen, setScreen] = useState(readScreen);
  const [selected, setSelected] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(readRecipe);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryMode, setDiscoveryMode] = useState("restaurants");
  const [recipeBack, setRecipeBack] = useState("discover");
  const [restaurantBack, setRestaurantBack] = useState("discover");
  const [restaurant, setRestaurant] = useState(restaurantTarget);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nearbyCandidates, setNearbyCandidates] = useState([]);
  let adminHint = false;
  try {
    const payload = getAccessToken().split(".")[1];
    adminHint =
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role ===
      "ADMIN";
  } catch {
    /* Navigation hint only; every admin API checks role on the server. */
  }
  useEffect(() => {
    if (!signedIn) setNearbyCandidates([]);
  }, [signedIn]);
  useEffect(() => {
    const changed = () => setNearbyCandidates([]);
    window.addEventListener("food-history-changed", changed);
    return () => window.removeEventListener("food-history-changed", changed);
  }, []);
  useEffect(() => {
    const chosen = (event) =>
      setNearbyCandidates((items) =>
        items.filter(
          (item) =>
            (!event.detail?.dishId || item.dishId !== event.detail.dishId) &&
            (!event.detail?.canonicalName ||
              (item.canonicalName !== event.detail.canonicalName &&
                !item.canonicalAliases?.includes(event.detail.canonicalName))),
        ),
      );
    window.addEventListener("food-choice-saved", chosen);
    return () => window.removeEventListener("food-choice-saved", chosen);
  }, []);
  useEffect(() => {
    const expire = () => {
      setSessionExpired(true);
      setSignedIn(false);
      setMessage("");
    };
    window.addEventListener("food-session-expired", expire);
    return () => window.removeEventListener("food-session-expired", expire);
  }, []);
  useEffect(() => {
    const offline = () => setOnline(false);
    const reconnect = () => {
      setOnline(true);
      setMessage(
        "Đã có kết nối mạng trở lại. Bạn có thể thử lại thao tác trước đó.",
      );
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", reconnect);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", reconnect);
    };
  }, []);
  const connectionNotice = !online && (
    <UserNotice tone="warning" title="Bạn đang ngoại tuyến">
      Kiểm tra kết nối mạng. Dữ liệu đang hiển thị có thể chưa cập nhật; thao
      tác lưu cần kết nối và xác nhận từ hệ thống.
    </UserNotice>
  );
  useEffect(() => {
    const sync = () => {
      const next = readScreen();
      const recipe = readRecipe();
      if (next === "restaurant") setRestaurant(restaurantTarget());
      if (recipe)
        setSelectedRecipe((old) =>
          old?.source === recipe.source && old?.id === recipe.id ? old : recipe,
        );
      setScreen(
        (next === "recipe" && !recipe) ||
          (next === "restaurant" && !restaurantTarget())
          ? "discover"
          : next,
      );
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const notice = (text) => setMessage(text);
  const navigate = (next, hash = next) => {
    setMessage("");
    setScreen(next);
    window.location.hash = hash;
  };
  const openDiscovery = (query = "", mode = "restaurants") => {
    setDiscoveryQuery(query);
    setDiscoveryMode(mode);
    navigate("discover");
  };
  const openRecipe = (recipe) => {
    setRecipeBack(screen === "today" ? "today" : "discover");
    setSelectedRecipe(recipe);
    navigate("recipe", `recipe/${recipe.source}/${recipe.id}`);
  };
  const openRestaurant = (place) => {
    setRestaurantBack(
      screen === "today" || screen === "dish" ? "today" : "discover",
    );
    const target = place.restaurantId
      ? { kind: "local", id: place.restaurantId }
      : { kind: "place", source: place.source || "google", id: place.placeId };
    if (!target.id) return;
    setRestaurant(target);
    navigate(
      "restaurant",
      target.kind === "local"
        ? `restaurant/local/${target.id}`
        : `restaurant/place/${target.source}/${encodeURIComponent(target.id)}`,
    );
  };
  if (!signedIn)
    return (
      <div className="food-shell">
        <div className="food-connection-notice">
          {connectionNotice}
          {sessionExpired && (
            <UserNotice
              tone="warning"
              title="Phiên đăng nhập đã hết hạn"
              onDismiss={() => setSessionExpired(false)}
            >
              Hãy đăng nhập lại để tiếp tục. Dữ liệu đã lưu trong tài khoản vẫn
              được giữ.
            </UserNotice>
          )}
          {message && (
            <UserNotice onDismiss={() => setMessage("")}>{message}</UserNotice>
          )}
        </div>
        {screen === "terms" || screen === "privacy" ? (
          <main className="food-main">
            <button onClick={() => navigate("today")}>← Đăng nhập</button>
            <PublicLegal screen={screen} />
          </main>
        ) : (
          <Auth
            onLogin={() => {
              setSignedIn(true);
              setSessionExpired(false);
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
        {adminHint && (
          <button
            onClick={() => navigate("admin")}
            aria-current={screen === "admin" ? "page" : undefined}
          >
            Quản trị
          </button>
        )}
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
        {screen === "admin" && <AdminMenu />}
        {connectionNotice}
        {message && (
          <UserNotice tone="success" onDismiss={() => setMessage("")}>
            {message}
          </UserNotice>
        )}
        {screen === "today" && (
          <Today
            navigate={navigate}
            onNearbyCandidates={setNearbyCandidates}
            onRecipe={openRecipe}
            onRestaurant={openRestaurant}
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
              notice("Đã lưu mô tả khẩu vị vào tài khoản của bạn.");
            }}
          />
        )}
        {screen === "history" && <History />}
        {(screen === "discover" ||
          (screen === "recipe" && recipeBack === "discover") ||
          (screen === "restaurant" && restaurantBack === "discover")) && (
          <div hidden={screen !== "discover"}>
            <Discovery
              key={`${discoveryMode}:${discoveryQuery}`}
              initialQuery={discoveryQuery}
              initialMode={discoveryMode}
              onRecipe={openRecipe}
              navigate={navigate}
              onRestaurant={openRestaurant}
            />
          </div>
        )}
        {screen === "recipe" && selectedRecipe && (
          <RecipeDetail
            selected={selectedRecipe}
            notice={notice}
            onBack={() => navigate(recipeBack)}
            onFindRestaurants={(name) => openDiscovery(name)}
          />
        )}
        {screen === "dish" && selected && (
          <DishDetail
            dish={selected}
            notice={notice}
            onRestaurant={openRestaurant}
            onBack={() => navigate("today")}
            onFindRecipes={() => openDiscovery(selected.name, "recipes")}
            onFindRestaurants={() => openDiscovery(selected.name)}
          />
        )}
        {screen === "restaurant" && restaurant && (
          <RestaurantDetail
            key={`${restaurant.kind}:${restaurant.source}:${restaurant.id}`}
            target={restaurant}
            onBack={() => navigate(restaurantBack)}
            notice={notice}
            onFindRecipes={(name) => openDiscovery(name, "recipes")}
          />
        )}
      </main>
      <nav className="food-nav" aria-label="Điều hướng chính">
        {[
          ["today", "Hôm nay"],
          ["discover", "Tìm món / Nấu ăn"],
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
      <LuckyWheel
        candidates={nearbyCandidates}
        notice={notice}
        onRestaurant={openRestaurant}
        onFind={() => {
          navigate("today");
          setTimeout(
            () => document.getElementById("nearby-budget")?.focus(),
            0,
          );
        }}
      />
      <footer className="food-legal">
        <p>
          Đặt món · Thanh toán · Giao hàng — <span lang="en">Coming soon</span>
        </p>
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
