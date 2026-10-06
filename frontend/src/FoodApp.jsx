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

const readScreen = () => {
  const name = window.location.hash.slice(1).split("/")[0];
  return [
    "today",
    "profile",
    "history",
    "dish",
    "terms",
    "privacy",
    "discover",
    "recipe",
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
  const [message, setMessage] = useState("");
  const [nearbyCandidates, setNearbyCandidates] = useState([]);
  useEffect(() => {
    if (!signedIn) setNearbyCandidates([]);
  }, [signedIn]);
  useEffect(() => {
    const expire = () => setSignedIn(false);
    window.addEventListener("food-session-expired", expire);
    return () => window.removeEventListener("food-session-expired", expire);
  }, []);
  useEffect(() => {
    const sync = () => {
      const next = readScreen();
      const recipe = readRecipe();
      if (recipe)
        setSelectedRecipe((old) =>
          old?.source === recipe.source && old?.id === recipe.id ? old : recipe,
        );
      setScreen(next === "recipe" && !recipe ? "discover" : next);
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
            onNearbyCandidates={setNearbyCandidates}
            onRecipe={openRecipe}
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
          (screen === "recipe" && recipeBack === "discover")) && (
          <div hidden={screen !== "discover"}>
            <Discovery
              key={`${discoveryMode}:${discoveryQuery}`}
              initialQuery={discoveryQuery}
              initialMode={discoveryMode}
              onRecipe={openRecipe}
              navigate={navigate}
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
            onBack={() => navigate("today")}
            onFindRecipes={() => openDiscovery(selected.name, "recipes")}
            onFindRestaurants={() => openDiscovery(selected.name)}
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
        onFind={() => {
          navigate("today");
          setTimeout(
            () => document.getElementById("nearby-budget")?.focus(),
            0,
          );
        }}
      />
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
