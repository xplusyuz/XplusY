import React from "react";
import { moneyUZS } from "../lib/format";

export default function ProductCard({ p, onOpen }) {
  const img = (p.imagesByColor && Object.values(p.imagesByColor)[0]?.[0]) || p.cover || p.image || "";
  return (
    <div className="card" onClick={() => onOpen(p)}>
      {p.oldPrice ? (
        <div className="badge">- {Math.max(1, Math.round((1 - p.price / p.oldPrice) * 100))}%</div>
      ) : null}
      {img ? <img className="cardImg" src={img} alt={p.title} loading="lazy" /> : <div className="cardImg" />}
      <div className="cardBody">
        <div className="cardTitle">{p.title}</div>
        <div className="priceRow">
          <div className="price">{moneyUZS(p.price)}</div>
          {p.oldPrice ? <div className="old">{moneyUZS(p.oldPrice)}</div> : null}
        </div>
        <div className="metaRow">
          <div className="rating">★ {Number(p.ratingAvg || 0).toFixed(1)} ({p.ratingCount || 0})</div>
          <button className="btn" type="button" onClick={(e)=>{e.stopPropagation(); onOpen(p);}}>Ko‘rish</button>
        </div>
      </div>
    </div>
  );
}
