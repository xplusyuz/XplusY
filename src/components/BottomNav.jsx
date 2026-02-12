import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const items = [
  { to: "/", label: "Home" },
  { to: "/categories", label: "Kategoriya" },
  { to: "/favorites", label: "Sevimli" },
  { to: "/cart", label: "Savat" },
  { to: "/profile", label: "Profil" },
];

export default function BottomNav({ cartCount = 0 }) {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <div className="bottomNav">
      <div className="bottomNavInner">
        {items.map((it) => {
          const active = loc.pathname === it.to;
          return (
            <button
              key={it.to}
              className={"navBtn" + (active ? " active" : "")}
              onClick={() => nav(it.to)}
              type="button"
            >
              <div className="dot" />
              <strong>{it.label}</strong>
              {it.to === "/cart" && cartCount > 0 && (
                <span className="countBadge">{cartCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
