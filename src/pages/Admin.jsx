import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { isAdminUser } from "../lib/admin";
import { moneyUZS } from "../lib/format";
import { useNavigate } from "react-router-dom";

export default function Admin({ user, toast }) {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const isAdmin = useMemo(() => isAdminUser(user), [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const pq = query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(50));
    const oq = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(50));
    const u1 = onSnapshot(pq, (s) => setProducts(s.docs.map(d => ({ id:d.id, ...d.data() }))));
    const u2 = onSnapshot(oq, (s) => setOrders(s.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [isAdmin]);

  const [pTitle, setPTitle] = useState("");
  const [pPrice, setPPrice] = useState("");

  async function addProduct(){
    try{
      if(!isAdmin) return;
      const id = "p_"+Math.random().toString(36).slice(2,10);
      await setDoc(doc(db,"products",id), {
        title: pTitle.trim(),
        desc: "",
        price: Number(pPrice||0),
        oldPrice: 0,
        ratingAvg: 0,
        ratingCount: 0,
        tags: [],
        isActive: true,
        variants: { colors: [{ key:"black", name:"Qora", hex:"#111" }], sizes: ["40","41","42"] },
        imagesByColor: { black: [] },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setPTitle(""); setPPrice("");
      toast("Qo‘shildi","Mahsulot yaratildi.");
    }catch(e){ toast("Xatolik", e?.message || "Qo‘shilmadi."); }
  }

  async function setOrderStatus(o, status){
    try{
      if(!isAdmin) return;
      await updateDoc(doc(db,"orders",o.id), { status, updatedAt: serverTimestamp() });
      toast("Yangilandi", `${o.orderNo} -> ${status}`);
    }catch(e){ toast("Xatolik", e?.message || "Yangilanmadi."); }
  }

  if(!user){
    return <div className="container" style={{paddingBottom:110}}><div className="h1">Admin</div><div className="panel" style={{padding:14}}><div className="p">Admin panel uchun login qiling.</div><button className="btn" onClick={()=>nav("/login")}>Kirish</button></div></div>;
  }
  if(!isAdmin){
    return <div className="container" style={{paddingBottom:110}}><div className="h1">Admin</div><div className="panel" style={{padding:14}}><div className="p">Siz admin emassiz.</div></div></div>;
  }

  return (
    <div className="container" style={{ paddingBottom: 110 }}>
      <div className="h1">Admin panel</div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="h2">Mahsulot qo‘shish</div>
        <div className="row">
          <input className="input" value={pTitle} onChange={(e)=>setPTitle(e.target.value)} placeholder="Mahsulot nomi" />
          <input className="input" value={pPrice} onChange={(e)=>setPPrice(e.target.value.replace(/\D/g,''))} placeholder="Narx (UZS)" />
        </div>
        <div style={{ height: 10 }} />
        <button className="btn" onClick={addProduct}>Qo‘shish</button>
      </div>

      <div style={{ height: 14 }} />

      <div className="row">
        <div className="panel" style={{ padding: 14, minWidth: 320 }}>
          <div className="h2">Products (50)</div>
          {products.map(p => (
            <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontWeight: 950 }}>{p.title}</div>
              <div style={{ color:"var(--muted)", fontWeight: 800, fontSize: 12 }}>
                {moneyUZS(p.price)} • active: {String(p.isActive)}
              </div>
            </div>
          ))}
        </div>

        <div className="panel" style={{ padding: 14, minWidth: 320 }}>
          <div className="h2">Orders (50)</div>
          {orders.map(o => (
            <div key={o.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap: 10, flexWrap:"wrap" }}>
                <div style={{ fontWeight: 950 }}>{o.orderNo}</div>
                <div className="price">{moneyUZS(o.totalAmount)}</div>
              </div>
              <div style={{ color:"var(--muted)", fontWeight: 800, fontSize: 12 }}>
                {o.userSnapshot?.omId || "-"} • {o.userSnapshot?.phone || "-"}
              </div>
              <div style={{ display:"flex", gap: 8, marginTop: 8, flexWrap:"wrap" }}>
                {["new","processing","shipped","done","cancelled"].map(s => (
                  <button key={s} className={s===o.status ? "btn" : "btnGhost"} onClick={()=>setOrderStatus(o,s)}>{s}</button>
                ))}
              </div>
              <div style={{ color:"var(--muted)", fontWeight: 800, fontSize: 12, marginTop: 8 }}>
                Payment: {o.payment?.status || "pending"} ({o.payment?.method || "-"})
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
