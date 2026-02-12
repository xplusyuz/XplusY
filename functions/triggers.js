const functions = require("firebase-functions");
const { sendTG, onceEvent, ADMIN_CHAT_ID, adminOrderHtml, userOrderHtml } = require("./telegram");

exports.onOrderCreated = functions.firestore.document("orders/{orderId}").onCreate(async (snap, ctx) => {
  const orderId = ctx.params.orderId;
  const o = snap.data();
  o.id = orderId;

  const ok = await onceEvent(`orders/${orderId}/ORDER_CREATED`);
  if (!ok) return;

  if (ADMIN_CHAT_ID) await sendTG(ADMIN_CHAT_ID, adminOrderHtml(o), "HTML");

  const userChatId = o.userSnapshot?.tgChatId;
  if (userChatId) await sendTG(userChatId, userOrderHtml(o), "HTML");
});

exports.onOrderUpdated = functions.firestore.document("orders/{orderId}").onUpdate(async (change, ctx) => {
  const orderId = ctx.params.orderId;
  const before = change.before.data();
  const after = change.after.data();

  if (before.status !== after.status) {
    const ok = await onceEvent(`orders/${orderId}/STATUS_${after.status}`);
    if (!ok) return;

    if (ADMIN_CHAT_ID) {
      await sendTG(ADMIN_CHAT_ID, `📦 <b>Status yangilandi</b>\n<b>ID:</b> ${after.orderNo}\n<b>Yangi:</b> ${after.status}`, "HTML");
    }

    const userChatId = after.userSnapshot?.tgChatId;
    if (userChatId) {
      await sendTG(userChatId, `📦 <b>Buyurtma holati yangilandi</b>\n<b>ID:</b> ${after.orderNo}\n<b>Holat:</b> ${after.status}`, "HTML");
    }
  }

  const beforePay = before.payment?.status;
  const afterPay = after.payment?.status;
  if (beforePay !== "paid" && afterPay === "paid") {
    const ok = await onceEvent(`orders/${orderId}/PAYMENT_PAID`);
    if (!ok) return;
    if (ADMIN_CHAT_ID) {
      await sendTG(ADMIN_CHAT_ID, `💳 <b>To'lov tasdiqlandi</b>\n<b>ID:</b> ${after.orderNo}\n<b>Summa:</b> ${after.totalAmount}`, "HTML");
    }
  }
});
