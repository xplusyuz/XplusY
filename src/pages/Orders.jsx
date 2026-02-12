import React, { useEffect, useState } from "react";
import { listenOrdersForUser } from "../lib/shopService";
import { moneyUZS } from "../lib/format";
import { useNavigate } from "react-router-dom";

export default function Orders({ user }) {
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenOrdersForUser(user.uid, setOrders);
    return () => unsub && unsub();
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="container" style={{ paddingBottom: 110 }}>
        <div className="h1">Buyurtmalar</div>
        <div className="panel" style={{ padding: 14 }}>
          <div className="p">Buyurtmalarni ko‘rish uchun login qiling.</div>
          <button className="btn" onClick={() => nav("/login")}>Kirish</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 110 }}>
      <div className="h1">Buyurtmalar</div>
      <div className="panel" style={{ padding: 14 }}>
        {orders.length ? orders.map(o => (
          <div key={o.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap: 10, flexWrap:"wrap" }}>
              <div style={{ fontWeight: 950 }}>{o.orderNo}</div>
              <div className="price">{moneyUZS(o.totalAmount)}</div>
            </div>
            <div style={{ color:"var(--muted)", fontWeight: 800, fontSize: 12 }}>
              Status: {o.status} • Payment: {o.payment?.status || "pending"} • Method: {o.payment?.method || "-"}
            </div>
          </div>
        )) : <div className="p">Hozircha buyurtma yo‘q.</div>}
      </div>
    </div>
  );
}
