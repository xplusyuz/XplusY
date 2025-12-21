// /netlify/functions/api.js
const { MongoClient, ObjectId } = require('mongodb');

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);

async function connectDB() {
  await client.connect();
  return client.db('leaderMathDB');
}

exports.handler = async (event, context) => {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  try {
    const db = await connectDB();
    const usersCollection = db.collection('foydalanuvchilar');
    
    // Login endpoint
    if (path === '/auth/login' && method === 'POST') {
      const { id, password } = JSON.parse(event.body);
      
      const user = await usersCollection.findOne({ loginId: id });
      
      if (!user) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Bunday ID topilmadi' })
        };
      }
      
      if (user.password !== password) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Parol noto‘g‘ri' })
        };
      }
      
      // Session yaratish
      const sessionId = new ObjectId().toString();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          user: {
            id: user._id.toString(),
            docId: user._id.toString(),
            data: user
          }
        })
      };
    }
    
    // Register endpoint
    if (path === '/auth/register' && method === 'POST') {
      const loginId = Math.floor(100000 + Math.random() * 900000).toString();
      const password = generatePassword(8);
      
      const newUser = {
        loginId,
        password,
        fullName: '',
        birthDate: '',
        region: '',
        district: '',
        points: 0,
        rank: 'Yangi foydalanuvchi',
        bestScore: 0,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await usersCollection.insertOne(newUser);
      const sessionId = result.insertedId.toString();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          loginId,
          password,
          user: {
            id: result.insertedId.toString(),
            docId: result.insertedId.toString(),
            data: newUser
          }
        })
      };
    }
    
    // Session tekshirish
    if (path.startsWith('/auth/session/') && method === 'GET') {
      const sessionId = path.split('/').pop();
      
      try {
        const user = await usersCollection.findOne({ 
          _id: new ObjectId(sessionId) 
        });
        
        if (!user) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Session not found' })
          };
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            user: {
              id: user._id.toString(),
              docId: user._id.toString(),
              data: user
            }
          })
        };
      } catch (err) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid session ID' })
        };
      }
    }
    
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };
    
  } catch (error) {
    console.error('API xatosi:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server xatosi' })
    };
  }
};

function generatePassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}