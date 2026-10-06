import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
export default function PlacePhoto({ photo, name }) {
  const root = useRef(null);
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let requested = false;
    setImage(null);
    setFailed(false);
    const load = () => {
      if (requested || !photo?.name) return;
      requested = true;
      apiRequest(`/places/photo?name=${encodeURIComponent(photo.name)}`)
        .then((response) => {
          if (active) setImage(response.data.imageUrl);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              load();
              observer.disconnect();
            }
          });
    if (observer && root.current) observer.observe(root.current);
    else load();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [photo?.name]);
  return (
    <figure className="food-nearby-photo" ref={root}>
      {image && !failed ? (
        <img
          src={image}
          alt={`Ảnh tại ${name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="food-photo-empty">
          {photo && !failed ? "Đang tải ảnh…" : "Chưa có ảnh từ nguồn"}
        </div>
      )}
      {image && !failed && (
        <figcaption>
          Ảnh tại quán · Google Maps
          {photo?.authors.map((author, index) => (
            <span key={index}>
              {" "}
              ·{" "}
              {author.url ? (
                <a href={author.url} target="_blank" rel="noreferrer">
                  {author.name}
                </a>
              ) : (
                author.name
              )}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
