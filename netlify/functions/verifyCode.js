const fs = require("fs");
const path = require("path");

exports.handler = async (event) => {
  const { code } = JSON.parse(event.body);

  const dataPath = path.join(__dirname, "../../data/codes.json");
  let codes = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  if (codes.includes(code)) {
    // Kodni ishlatilgandan keyin olib tashlaymiz
    codes = codes.filter(c => c !== code);
    fs.writeFileSync(dataPath, JSON.stringify(codes, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "✅ Kod to‘g‘ri!" }),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, message: "❌ Kod noto‘g‘ri yoki ishlatilgan!" }),
    };
  }
};
