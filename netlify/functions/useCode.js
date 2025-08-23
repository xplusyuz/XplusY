exports.handler = async (event) => {
  const { code } = JSON.parse(event.body);

  // TODO: bu kodni saqlangan ro‘yxatdan tekshirish va ishlatilganini belgilash

  if (code === "TEST123") { // vaqtinchalik
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: false, message: "❌ Kod noto‘g‘ri yoki ishlatilgan." })
  };
};
