import React from "react";
import { useNavigate } from "react-router-dom";

export default function Topbar({ search, setSearch, user, userDoc, onLogout }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      <div className="topbarInner">
        <div className="brand" onClick={() => nav("/")} style={{ cursor: "pointer" }}>
          <div className="logo">OM</div>
          <div>
            <div className="brandTitle">Orzu<b>Mall</b></div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>2.0 Premium</div>
          </div>
        </div>

        <div className="searchWrap">
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish: mahsulot nomi..."
          />
        </div>

        <div className="chip" style={{ minWidth: 220 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: "rgba(212,175,55,.85)" }} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 950 }}>{userDoc?.name?.trim() ? userDoc.name : "Mehmon"}</div>
            <small>{userDoc?.omId ? userDoc.omId : user ? "Profil yaratilyapti..." : "Kirish kerak"}</small>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {user ? (
              <button className="btnGhost" onClick={onLogout}>Chiqish</button>
            ) : (
              <button className="btn" onClick={() => nav("/login")}>Kirish</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
