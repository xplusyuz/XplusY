import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendSms } from "../lib/authPhone";
import { phoneUzNormalize } from "../lib/format";

export default function Login({ toast }) {
  const [phone, setPhone] = useState("+998");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const phoneE164 = useMemo(() => phoneUzNormalize(phone), [phone]);
  const nav = useNavigate();

  async function onSend() {
    try {
      setLoading(true);
      const conf = await sendSms(phoneE164);
      setConfirmation(conf);
      setStep("code");
      toast("SMS yuborildi", "Kod kelgach kiriting.");
    } catch (e) {
      toast("Xatolik", e?.message || "SMS yuborilmadi.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    try {
      setLoading(true);
      if (!confirmation) throw new Error("SMS yuborilmagan");
      await confirmation.confirm(code);
      toast("Kirdi", "Profil yaratilyapti...");
      nav("/");
    } catch (e) {
      toast("Kod xato", e?.message || "Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingBottom: 110 }}>
      <div className="h1">Kirish</div>
      <div className="p">Telefon raqam orqali kirish (SMS kod).</div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="h2">1) Telefon</div>
        <input className="input" value={phone} onChange={(e)=>setPhone(phoneUzNormalize(e.target.value))} placeholder="+998901234567" />
        <div style={{ height: 10 }} />
        <div id="recaptcha-container" />
        <button className="btn" onClick={onSend} disabled={loading || step !== "phone"}>
          {loading && step === "phone" ? "Yuborilyapti..." : "SMS yuborish"}
        </button>

        <div className="hr" />

        <div className="h2">2) Kod</div>
        <input className="input" value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" />
        <div style={{ height: 10 }} />
        <div className="row">
          <button className="btn" onClick={onVerify} disabled={loading || step !== "code"}>
            {loading && step === "code" ? "Tekshirilmoqda..." : "Kirish"}
          </button>
          <button className="btnGhost" onClick={()=>{setStep('phone');setCode('')}} disabled={loading}>Qayta SMS</button>
        </div>
      </div>
    </div>
  );
}
