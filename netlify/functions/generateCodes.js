const fs = require("fs");
const path = require("path");

exports.handler = async () => {
  const codes = [];
  for (let i = 0; i < 100; i++) {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    codes.push(code);
  }

  const dataPath = path.join(__dirname, "../../data/codes.json");
  fs.writeFileSync(dataPath, JSON.stringify(codes, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "✅ 100 ta kod yaratildi!", codes }),
  };
};
