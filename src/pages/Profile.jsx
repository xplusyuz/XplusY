import React, { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function Profile({ user, userDoc, toast }) {
  const nav = useNavigate();
  const [name, setName] = useState(userDoc?.name || "");

  useEffect(() => { setName(userDoc?.name || ""); }, [userDoc?.name]);

  async function save() {
    try {
      if (!user) { toast("Kirish kerak","Profil uchun login qiling."); nav("/login"); return; }
      await updateDoc(doc(db,"users",user.uid), { name, updatedAt: serverTimestamp() });
      toast("Saqlandi","Profil yangilandi.");
    } catch (e) { toast("Xatolik", e?.message || "Saqlanmadi."); }
  }

  return (
    <div className="container" style={{ paddingBottom: 110 }}>
      <div className="h1">Profil</div>
      <div className="panel" style={{ padding: 14 }}>
        <div className="h2">Foydalanuvchi</div>
        <div className="p"><b>OM ID:</b> {userDoc?.omId || "—"}<br/><b>Telefon:</b> {userDoc?.phone || "—"}</div>
        <div className="hr" />
        <div className="h2">Ism</div>
        <input className="input" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ism Familiya" />
        <div style={{ height: 10 }} />
        <button className="btn" onClick={save}>Saqlash</button>
      </div>
    </div>
  );
}
