import React, { useEffect, useMemo, useState } from "react";
import { listenCart, removeFromCart, createOrder, clearCart } from "../lib/shopService";
import { moneyUZS } from "../lib/format";
import { useNavigate } from "react-router-dom";

export default function Cart({ user, userDoc, toast }) {
  const nav = useNavigate();
  const [cart, setCart] = useState({ items: [] });
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listenCart(user.uid, setCart);
    return () => unsub && unsub();
  }, [user?.uid]);

  const total = useMemo(() => (cart.items || []).reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1),0), [cart]);

  async function del(i) {
    if (!user) return;
    const key = `${i.productId}__${i.colorKey || ""}__${i.size || ""}`;
    await removeFromCart(user.uid, key);
  }

  async function checkout() {
    try {
      if (!user) { toast("Kirish kerak","Buyurtma berish uchun login qiling."); nav("/login"); return; }
      if (!cart.items?.length) { toast("Savat bo‘sh","Mahsulot qo‘shing."); return; }
      if (!address.trim()) { toast("Manzil kerak","Yetkazib berish manzilini kiriting."); return; }
      setLoading(true);

      const order = await createOrder({
        uid: user.uid,
        userSnapshot: { name: userDoc?.name||"", phone: userDoc?.phone||"", omId: userDoc?.omId||"" },
        items: cart.items,
        delivery: { type:"text", addressText: address.trim() },
        paymentMethod
      });

      await clearCart(user.uid);
      toast("Buyurtma yaratildi", `${order.orderNo} — ${moneyUZS(order.totalAmount)}`);
      if (paymentMethod === "payme") toast("Payme", "Payme checkout + verify Functions bilan keyingi patchda ulangan.");
      nav("/orders");
    } catch (e) {
      toast("Xatolik", e?.message || "Buyurtma yaratilmagan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingBottom: 110 }}>
      <div className="h1">Savat</div>
      {!user ? (
        <div className="panel" style={{ padding: 14 }}>
          <div className="p">Savatni ko‘rish uchun tizimga kiring.</div>
          <button className="btn" onClick={() => nav("/login")}>Kirish</button>
        </div>
      ) : (
        <>
          <div className="panel" style={{ padding: 14 }}>
            {(cart.items || []).length ? (
              <>
                {(cart.items || []).map((i, idx) => (
                  <div key={idx} style={{ display:"flex", gap: 12, alignItems:"center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 14, overflow:"hidden", border:"1px solid var(--line)", background:"rgba(255,255,255,.04)" }}>
                      {i.image ? <img src={i.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 950 }}>{i.title}</div>
                      <div style={{ color:"var(--muted)", fontWeight: 800, fontSize: 12 }}>
                        {i.colorKey || "-"} / {i.size || "-"} • x{i.qty}
                      </div>
                      <div className="price">{moneyUZS(Number(i.price||0) * Number(i.qty||1))}</div>
                    </div>
                    <button className="btnGhost" onClick={() => del(i)}>O‘chirish</button>
                  </div>
                ))}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop: 12 }}>
                  <div style={{ fontWeight: 950 }}>Jami:</div>
                  <div className="price" style={{ fontSize: 20 }}>{moneyUZS(total)}</div>
                </div>
              </>
            ) : (
              <div className="p">Savat bo‘sh.</div>
            )}
          </div>

          <div style={{ height: 14 }} />

          <div className="panel" style={{ padding: 14 }}>
            <div className="h2">Buyurtma berish</div>
            <textarea className="input" style={{ height: 90, resize:"vertical" }} value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Masalan: Namangan, ... ko‘cha, uy ..." />
            <div style={{ height: 10 }} />
            <div className="row">
              <div>
                <div style={{ color:"var(--muted)", fontWeight: 800, marginBottom: 6 }}>To‘lov</div>
                <select className="input" value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)}>
                  <option value="cash">Naqd</option>
                  <option value="payme">Hozir to‘lash (Payme)</option>
                </select>
              </div>
              <div style={{ minWidth: 220, display:"flex", alignItems:"flex-end" }}>
                <button className="btn" onClick={checkout} disabled={loading}>
                  {loading ? "Yaratilyapti..." : "Buyurtma berish"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
