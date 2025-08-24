// api/users.js
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  try {
    const usersPath = path.join(process.cwd(), 'data', 'users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);
    
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify(users.users)
      };
    }
    
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      
      if (body.action === 'update') {
        const userId = parseInt(body.id);
        const newBalance = parseInt(body.balans);
        
        // Foydalanuvchini topib, balansini yangilash
        const userIndex = users.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          users.users[userIndex].balans = newBalance;
          
          // Yangilangan ma'lumotlarni saqlash
          await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
          
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
          };
        } else {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Foydalanuvchi topilmadi' })
          };
        }
      }
    }
    
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Noto‘g‘ri so‘rov' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};