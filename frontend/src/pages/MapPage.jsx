import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchNearbyFood } from "../dashboardApi.js";
import { nearbyToPlace } from "../dashboardAdapters.js";

const money = (value) =>
  typeof value === "number" ? `${value.toLocaleString("vi-VN")}đ` : "";
const distance = (value) => {
  if (typeof value !== "number") return "";
  return value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`;
};

const validCoordinate = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

const DEFAULT_CENTER = {
  latitude: 21.0315,
  longitude: 105.7895,
  label: "Cầu Giấy, Hà Nội",
};

export const getPlaceImage = (place) => {
  if (place?.image) return place.image;
  const text = `${place?.name || ""} ${place?.dish || ""} ${place?.address || ""}`.toLowerCase();
  if (text.includes("phở")) return "/images/dishes/pho-bo.jpg";
  if (text.includes("bún bò")) return "/images/dishes/bun-bo-hue.jpg";
  if (text.includes("bún")) return "/images/dishes/bun-cha.jpg";
  if (text.includes("cơm")) return "/images/dishes/com-tam-suon-trung.jpg";
  if (text.includes("bánh mì")) return "/images/dishes/banh-mi-thit.jpg";
  if (text.includes("bánh cuốn")) return "/images/dishes/banh-cuon.jpg";
  if (text.includes("bánh xèo")) return "/images/dishes/banh-xeo.jpg";
  if (text.includes("steak") || text.includes("bò") || text.includes("nướng")) return "/images/dishes/bo-luc-lac.jpg";
  if (text.includes("sushi") || text.includes("udon") || text.includes("nhật") || text.includes("japanese")) return "/images/dishes/sushi-set.jpg";
  if (text.includes("lẩu") || text.includes("buffet") || text.includes("hải sản")) return "/images/dishes/goi-cuon-tom-thit.jpg";
  if (text.includes("trà sữa")) return "/images/dishes/tra-sua-tran-chau.jpg";
  if (text.includes("cà phê") || text.includes("coffee") || text.includes("cafe")) return "/images/dishes/ca-phe-sua-da.jpg";
  if (text.includes("chè")) return "/images/dishes/che-dau-xanh.jpg";
  return "/images/dishes/pho-bo.jpg";
};

function createUserIcon() {
  return L.divIcon({
    className: "leaflet-user-marker",
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(255,123,0,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="width:14px;height:14px;border-radius:9999px;background:#ff7b00;border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createRestaurantIcon(place, isSelected) {
  const bg = isSelected ? "#7c3aed" : "#ff7b00";
  const safeName = (place.name || "Quán").replace(/[<>"']/g, "");
  const ratingText = place.rating
    ? `<span style="font-size:10px;color:#fef08a;margin-left:3px;">★${place.rating}</span>`
    : "";
  return L.divIcon({
    className: `leaflet-restaurant-pin ${isSelected ? "selected" : ""}`,
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:${isSelected ? "scale(1.15)" : "scale(1)"};transition:transform 0.2s ease;">
        <div style="background:${bg};color:#ffffff;padding:4px 8px;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.25);border:2px solid #ffffff;display:flex;align-items:center;gap:3px;font-weight:800;font-size:11px;white-space:nowrap;max-width:140px;">
          <span class="material-symbols-outlined" style="font-size:13px;line-height:1;">restaurant</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${safeName}</span>
          ${ratingText}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [140, 34],
    iconAnchor: [70, 34],
    popupAnchor: [0, -34],
  });
}

export default function MapPage({
  onNavigate,
  profile,
  profileLoaded = true,
  currentLocation,
  locationStatus = "idle",
  locationError = "",
  onUseCurrentLocation = () => {},
}) {
  const [category, setCategory] = useState("all");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [allPlaces, setAllPlaces] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [providerStatus, setProviderStatus] = useState(null);
  const [mobileView, setMobileView] = useState("split");

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  useEffect(() => {
    if (!profileLoaded && !currentLocation) return;
    let active = true;
    setLoadState("loading");
    setProviderStatus(null);
    setSelectedPlace(null);
    const radius = Math.min(4000, Math.max(3000, profile?.maxDistanceMeters || 3500));
    const latitude = currentLocation?.latitude ?? profile?.latitude ?? DEFAULT_CENTER.latitude;
    const longitude = currentLocation?.longitude ?? profile?.longitude ?? DEFAULT_CENTER.longitude;
    const input = {
      budget: profile?.budgetMax || 70000,
      radius,
      latitude,
      longitude,
    };
    fetchNearbyFood(input)
      .then((payload) => {
        if (!active) return;
        const combined = [...(payload?.items || []), ...(payload?.restaurants || [])];
        const unique = new Map();
        combined
          .map(nearbyToPlace)
          .filter(Boolean)
          .forEach((place) => unique.set(place.id, place));
        setAllPlaces([...unique.values()]);
        setProviderStatus(payload?.status || null);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) {
          setAllPlaces([]);
          setLoadState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [currentLocation, profile, profileLoaded]);

  const places = useMemo(() => {
    if (category === "Gần nhất (< 1km)")
      return allPlaces.filter(
        (place) => place.distanceMeters != null && place.distanceMeters < 1000,
      );
    if (category === "Bún & Phở")
      return allPlaces.filter((place) => /bún|phở/i.test(`${place.dish || ""} ${place.name}`));
    if (category === "Cơm trưa")
      return allPlaces.filter((place) => /cơm/i.test(`${place.dish || ""} ${place.name}`));
    if (category === "Healthy")
      return allPlaces.filter((place) =>
        /chay|salad|healthy|rau|nước ép|trái cây/i.test(`${place.dish || ""} ${place.name}`),
      );
    return allPlaces;
  }, [allPlaces, category]);

  // Leaflet map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    try {
      const initialCenter = validCoordinate(currentLocation?.latitude, currentLocation?.longitude)
        ? [currentLocation.latitude, currentLocation.longitude]
        : validCoordinate(profile?.latitude, profile?.longitude)
        ? [profile.latitude, profile.longitude]
        : [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      L.control.zoom({ position: "topright" }).addTo(map);

      const markersGroup = L.featureGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    } catch {
      // Graceful fallback if Leaflet cannot instantiate
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, []);

  // Update map markers when places, user coordinates or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // 1. User Position marker
    const userLat = currentLocation?.latitude ?? profile?.latitude;
    const userLng = currentLocation?.longitude ?? profile?.longitude;
    if (validCoordinate(userLat, userLng)) {
      const userMarker = L.marker([userLat, userLng], {
        icon: createUserIcon(),
        title: "Vị trí của bạn",
        zIndexOffset: 1000,
      }).addTo(markersGroup);
      userMarker.bindPopup(`
        <div style="font-family:inherit;font-size:12px;font-weight:700;padding:2px;">
          📍 Vị trí của bạn: ${currentLocation ? "GPS hiện tại" : profile?.areaLabel || "Đã lưu"}
        </div>
      `);
    }

    // 2. Restaurant Markers
    const bounds = [];
    if (validCoordinate(userLat, userLng)) bounds.push([userLat, userLng]);

    places.forEach((place) => {
      if (!validCoordinate(place.latitude, place.longitude)) return;
      bounds.push([place.latitude, place.longitude]);
      const isSelected = selectedPlace?.id === place.id;
      const marker = L.marker([place.latitude, place.longitude], {
        icon: createRestaurantIcon(place, isSelected),
        title: place.name,
        zIndexOffset: isSelected ? 500 : 100,
      }).addTo(markersGroup);

      marker.on("click", () => {
        setSelectedPlace(place);
      });

      marker.bindPopup(`
        <div style="font-family:inherit;font-size:12px;padding:4px;min-width:180px;">
          <strong style="display:block;font-size:13px;color:#111827;margin-bottom:2px;">📍 ${place.name}</strong>
          <p style="margin:0 0 4px;color:#6b7280;font-size:11px;">${place.address || ""}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:4px;border-top:1px solid #e5e7eb;">
            <span style="color:#ff7b00;font-weight:800;">${place.price ? money(place.price) : place.distanceMeters ? distance(place.distanceMeters) : ""}</span>
            <span style="color:#d97706;font-weight:700;">${place.rating ? `★ ${place.rating}` : ""}</span>
          </div>
        </div>
      `);
    });

    if (selectedPlace && validCoordinate(selectedPlace.latitude, selectedPlace.longitude)) {
      map.flyTo([selectedPlace.latitude, selectedPlace.longitude], 16, { duration: 0.6 });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [places, currentLocation, profile, selectedPlace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [mobileView]);

  const handleSelectPlace = (place) => {
    setSelectedPlace(place);
    if (validCoordinate(place.latitude, place.longitude) && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([place.latitude, place.longitude], 16, { duration: 0.8 });
    }
  };

  return (
    <div className="flex flex-col xl:flex-row h-full w-full p-2.5 sm:p-4 lg:p-6 lg:pt-2 gap-3 lg:gap-6 overflow-hidden bg-[#f8f9fa]">
      {/* Mobile Tab Toggle */}
      <div className="flex xl:hidden rounded-2xl bg-gray-200/80 p-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileView("split")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-black transition ${
            mobileView === "split"
              ? "bg-white text-[#ff7b00] shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          📱 Cả hai
        </button>
        <button
          type="button"
          onClick={() => setMobileView("map")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-black transition ${
            mobileView === "map"
              ? "bg-white text-[#ff7b00] shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          🗺️ Bản đồ
        </button>
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-black transition ${
            mobileView === "list"
              ? "bg-white text-[#ff7b00] shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          📋 Danh sách ({places.length})
        </button>
      </div>

      {/* Left List of Restaurants */}
      <div
        className={`
          ${mobileView === "map" ? "hidden xl:flex" : "flex"}
          ${mobileView === "split" ? "flex-1 min-h-0" : "flex-1 h-full"}
          w-full xl:w-[460px] order-2 xl:order-1 shrink-0 flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden
        `}
      >
        {/* Search & Filter Header */}
        <div className="p-4 lg:p-5 border-b border-gray-100 bg-white z-10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Bản đồ Quán Ngon</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Tìm thấy {places.length} quán thật quanh {currentLocation ? "GPS của bạn" : (profile?.areaLabel || DEFAULT_CENTER.label)}
              </p>
            </div>
            <button
              onClick={onUseCurrentLocation}
              disabled={locationStatus === "loading"}
              title={locationError || "Dùng vị trí hiện tại để tìm quán gần bạn"}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition ${
                locationStatus === "error"
                  ? "bg-red-50 text-red-600"
                  : "bg-green-50 text-green-600 hover:bg-green-100"
              }`}
            >
              <span
                className={`material-symbols-outlined text-sm ${
                  locationStatus === "loading" ? "animate-pulse" : ""
                }`}
              >
                my_location
              </span>
              {locationStatus === "loading"
                ? "Đang định vị..."
                : locationStatus === "success"
                  ? "Đang dùng GPS"
                  : locationStatus === "error"
                    ? "Thử lại vị trí"
                    : "Dùng vị trí hiện tại"}
            </button>
          </div>
          {locationStatus === "error" && locationError && (
            <p role="alert" className="mb-3 text-[11px] font-bold text-red-600">
              {locationError}
            </p>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {["Tất cả", "Gần nhất (< 1km)", "Bún & Phở", "Cơm trưa", "Healthy"].map(
              (item, idx) => (
                <button
                  key={idx}
                  onClick={() => setCategory(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    category === item || (idx === 0 && category === "all")
                      ? "bg-[#ff7b00] text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadState === "loading" && (
            <p role="status" className="p-4 text-center text-sm text-gray-500">
              Đang tìm quán quanh {currentLocation ? "vị trí hiện tại" : "vị trí đã lưu"}...
            </p>
          )}
          {loadState === "error" && (
            <p role="alert" className="p-4 text-center text-sm text-red-600">
              Không thể tải dữ liệu quán lúc này.
            </p>
          )}
          {loadState === "ready" && places.length === 0 && (
            <p role="status" className="p-4 text-center text-sm text-gray-500">
              {providerStatus === "NOT_CONFIGURED"
                ? "Nguồn dữ liệu quán chưa được cấu hình. Bản đồ vẫn hiển thị vị trí đã lưu."
                : "Chưa tìm thấy quán phù hợp trong bán kính đã chọn."}
            </p>
          )}
          {places.map((place) => {
            const active = selectedPlace?.id === place.id;
            return (
              <div
                key={place.id}
                onClick={() => handleSelectPlace(place)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                  active
                    ? "border-[#ff7b00] bg-orange-50/40 shadow-sm"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <img
                  src={getPlaceImage(place)}
                  alt={place.name}
                  className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-bold text-sm text-gray-900 truncate">{place.name}</h3>
                    {place.rating != null && (
                      <span className="text-[#ff7b00] font-bold text-xs shrink-0 flex items-center gap-0.5">
                        <span
                          className="material-symbols-outlined text-[13px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        {place.rating}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mb-1.5">{place.address}</p>
                  {(place.distanceMeters != null || place.price != null) && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold mb-2">
                      {place.distanceMeters != null && (
                        <span className="text-[#00a67d] bg-[#e6f6f2] px-1.5 py-0.5 rounded">
                          {distance(place.distanceMeters)}
                        </span>
                      )}
                      {place.price != null && <span>{money(place.price)}</span>}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {onNavigate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate("chat");
                        }}
                        className="px-2.5 py-1 bg-[#ff7b00] text-white text-[10px] font-bold rounded-lg hover:bg-[#e66a00] transition-colors"
                      >
                        Hỏi AI về quán
                      </button>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        const url =
                          place.mapsUrl ||
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            place.name + " " + place.address,
                          )}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-0.5"
                    >
                      <span>Chỉ đường</span>
                      <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Map Canvas with Leaflet */}
      <section
        aria-label="Bản đồ tương tác"
        className={`
          ${mobileView === "list" ? "hidden xl:flex" : "flex"}
          ${mobileView === "split" ? "h-[42vh] min-h-[250px] max-h-[380px] shrink-0 xl:h-full xl:max-h-none" : "flex-1 h-full min-h-[260px]"}
          w-full xl:flex-1 order-1 xl:order-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative flex-col
        `}
      >
        <div className="w-full h-full min-h-[220px] relative bg-[#e5e9f0] overflow-hidden">
          {/* Leaflet DOM container */}
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

          {/* Top Right Quick Controls */}
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const userLat = currentLocation?.latitude ?? profile?.latitude;
                const userLng = currentLocation?.longitude ?? profile?.longitude;
                if (validCoordinate(userLat, userLng) && mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([userLat, userLng], 16, { duration: 0.8 });
                } else {
                  onUseCurrentLocation();
                }
              }}
              title="Căn giữa vị trí của bạn"
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-bold text-gray-700 shadow-md hover:bg-white active:scale-95 transition"
            >
              <span className="material-symbols-outlined text-sm text-[#ff7b00]">my_location</span>
              <span className="hidden sm:inline">Vị trí của tôi</span>
            </button>
            <a
              href={`https://www.openstreetmap.org/#map=15/${
                currentLocation?.latitude || profile?.latitude || DEFAULT_CENTER.latitude
              }/${
                currentLocation?.longitude || profile?.longitude || DEFAULT_CENTER.longitude
              }`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-bold text-gray-700 shadow-md hover:bg-white"
            >
              Mở OSM
            </a>
          </div>

          {/* Active Place Overlay Card (Bottom Sheet Floating Card) */}
          {selectedPlace && (
            <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-gray-200 z-30 flex gap-3.5 animate-fadeInScale">
              <img
                src={getPlaceImage(selectedPlace)}
                alt={selectedPlace.name}
                className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-extrabold text-sm text-gray-900 truncate">
                    {selectedPlace.name}
                  </h4>
                  <button
                    onClick={() => setSelectedPlace(null)}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  {selectedPlace.address || "Địa chỉ quanh khu vực"}
                </p>
                {(selectedPlace.distanceMeters != null || selectedPlace.price != null) && (
                  <p className="text-[11px] font-bold text-[#ff7b00] mt-1">
                    {[
                      distance(selectedPlace.distanceMeters),
                      money(selectedPlace.price),
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        selectedPlace.mapsUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          selectedPlace.name + " " + (selectedPlace.address || ""),
                        )}`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    className="flex-1 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-1"
                  >
                    <span>Chỉ đường</span>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </button>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate("chat")}
                      className="flex-1 py-1.5 bg-[#ff7b00] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#e66a00] transition"
                    >
                      Hỏi AI về quán
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
