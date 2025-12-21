const { MongoClient, ObjectId } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);
let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;
  await client.connect();
  cachedDb = client.db("leaderMathDB");
  return cachedDb;
}

exports.handler = async (event) => {
  const path = event.path.replace("/.netlify/functions/api", "");
  const method = event.httpMethod;

  try {
    const db = await connectDB();
    const users = db.collection("foydalanuvchilar");

    // LOGIN
    if (path === "/auth/login" && method === "POST") {
      const { id, password } = JSON.parse(event.body);
      const user = await users.findOne({ loginId: id });

      if (!user) return res(404, "Bunday ID yo‘q");
      if (user.password !== password) return res(401, "Parol noto‘g‘ri");

      return res(200, {
        sessionId: user._id.toString(),
        user
      });
    }

    return res(404, "Endpoint not found");

  } catch (e) {
    console.error(e);
    return res(500, "Server error");
  }
};

function res(code, body) {
  return {
    statusCode: code,
    body: JSON.stringify(body)
  };
}
