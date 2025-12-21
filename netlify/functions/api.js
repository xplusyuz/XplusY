// Netlify serverless function - API endpoint
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Firebase initialize (agar hali bo'lmasa)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Utility functions
function generateId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePassword() {
  return crypto.randomBytes(4).toString('hex');
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

function getRank(points) {
  points = parseInt(points) || 0;
  if (points >= 1000000) return "Legenda";
  if (points >= 500000) return "Ustoz";
  if (points >= 200000) return "Faol talaba";
  if (points >= 50000) return "Faol foydalanuvchi";
  if (points >= 1000) return "Boshlovchi";
  return "Yangi ishtirokchi";
}

// Main API handler
exports.handler = async function(event, context) {
  try {
    const { path, httpMethod } = event;
    const pathSegments = path.replace('/.netlify/functions/api', '').split('/').filter(Boolean);
    
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Content-Type': 'application/json'
    };
    
    // Handle OPTIONS request (CORS preflight)
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }
    
    // Route handling
    const route = pathSegments[0];
    
    switch(route) {
      case 'auth':
        return await handleAuth(event, pathSegments.slice(1));
      case 'user':
        return await handleUser(event, pathSegments.slice(1));
      case 'ranking':
        return await handleRanking(event);
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Server error: ' + error.message })
    };
  }
};

// Auth handlers
async function handleAuth(event, segments) {
  const { httpMethod, body } = event;
  const subRoute = segments[0];
  
  switch(httpMethod) {
    case 'POST':
      if (subRoute === 'login') {
        return await loginUser(JSON.parse(body || '{}'));
      } else if (subRoute === 'register') {
        return await registerUser();
      }
      break;
      
    case 'GET':
      if (subRoute === 'session' && segments[1]) {
        return await checkSession(segments[1]);
      }
      break;
  }
  
  return {
    statusCode: 404,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Auth endpoint not found' })
  };
}

// User handlers
async function handleUser(event, segments) {
  const { httpMethod, body } = event;
  const userId = segments[0];
  const subRoute = segments[1];
  
  if (!userId) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'User ID required' })
    };
  }
  
  switch(httpMethod) {
    case 'GET':
      return await getUser(userId);
      
    case 'PATCH':
      return await updateUser(userId, JSON.parse(body || '{}'));
      
    case 'POST':
      if (subRoute === 'avatar') {
        return await updateAvatar(userId, JSON.parse(body || '{}'));
      } else if (subRoute === 'password') {
        return await changePassword(userId, JSON.parse(body || '{}'));
      }
      break;
  }
  
  return {
    statusCode: 404,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'User endpoint not found' })
  };
}

// Ranking handler
async function handleRanking(event) {
  try {
    const usersRef = db.collection('foydalanuvchilar');
    const snapshot = await usersRef.get();
    
    const users = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        loginId: userData.loginId || '',
        points: parseInt(userData.points) || 0,
        birthDate: userData.birthDate || null,
        region: userData.region || '',
        district: userData.district || '',
        avatar: userData.avatar || null,
        rank: userData.rank || getRank(userData.points || 0),
        age: calculateAge(userData.birthDate),
        createdAt: userData.createdAt || null
      });
    });
    
    // Sort by points (highest first)
    users.sort((a, b) => b.points - a.points);
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    };
    
  } catch (error) {
    console.error('Ranking error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get ranking' })
    };
  }
}

// Login function
async function loginUser({ id, password }) {
  try {
    if (!id || !password) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ID va parol talab qilinadi' })
      };
    }
    
    const usersRef = db.collection('foydalanuvchilar');
    const snapshot = await usersRef.where('loginId', '==', id).get();
    
    if (snapshot.empty) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Foydalanuvchi topilmadi' })
      };
    }
    
    let userDoc, userData;
    snapshot.forEach(doc => {
      userDoc = doc;
      userData = doc.data();
    });
    
    if (userData.password !== password) {
      return {
        statusCode: 401,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Noto‘g‘ri parol' })
      };
    }
    
    // Generate session ID
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Update last login
    await userDoc.ref.update({
      lastLogin: new Date().toISOString(),
      sessionId: sessionId
    });
    
    // Prepare response
    const userResponse = {
      id: userDoc.id,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || '',
      loginId: userData.loginId,
      points: userData.points || 0,
      birthDate: userData.birthDate || null,
      region: userData.region || '',
      district: userData.district || '',
      avatar: userData.avatar || null,
      rank: userData.rank || getRank(userData.points || 0),
      age: calculateAge(userData.birthDate),
      createdAt: userData.createdAt || null
    };
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user: userResponse,
        sessionId 
      })
    };
    
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Login failed: ' + error.message })
    };
  }
}

// Register function
async function registerUser() {
  try {
    const loginId = generateId();
    const password = generatePassword();
    
    const newUser = {
      loginId,
      password,
      firstName: '',
      lastName: '',
      email: '',
      points: 0,
      birthDate: null,
      region: '',
      district: '',
      avatar: null,
      rank: 'Yangi ishtirokchi',
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    // Check if ID already exists
    const existing = await db.collection('foydalanuvchilar')
      .where('loginId', '==', loginId)
      .get();
    
    if (!existing.empty) {
      // Retry with new ID
      return registerUser();
    }
    
    const docRef = await db.collection('foydalanuvchilar').add(newUser);
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Update with session ID
    await docRef.update({ sessionId });
    
    const userResponse = {
      id: docRef.id,
      ...newUser,
      age: calculateAge(newUser.birthDate)
    };
    
    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user: userResponse,
        loginId,
        password,
        sessionId 
      })
    };
    
  } catch (error) {
    console.error('Register error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Registration failed: ' + error.message })
    };
  }
}

// Check session function
async function checkSession(sessionId) {
  try {
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }
    
    const usersRef = db.collection('foydalanuvchilar');
    const snapshot = await usersRef.where('sessionId', '==', sessionId).get();
    
    if (snapshot.empty) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Session not found' })
      };
    }
    
    let userData;
    snapshot.forEach(doc => {
      userData = doc.data();
      userData.id = doc.id;
    });
    
    const userResponse = {
      id: userData.id,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || '',
      loginId: userData.loginId,
      points: userData.points || 0,
      birthDate: userData.birthDate || null,
      region: userData.region || '',
      district: userData.district || '',
      avatar: userData.avatar || null,
      rank: userData.rank || getRank(userData.points || 0),
      age: calculateAge(userData.birthDate),
      createdAt: userData.createdAt || null
    };
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userResponse })
    };
    
  } catch (error) {
    console.error('Session check error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Session check failed' })
    };
  }
}

// Get user function
async function getUser(userId) {
  try {
    const userDoc = await db.collection('foydalanuvchilar').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Foydalanuvchi topilmadi' })
      };
    }
    
    const userData = userDoc.data();
    const userResponse = {
      id: userDoc.id,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || '',
      loginId: userData.loginId,
      points: userData.points || 0,
      birthDate: userData.birthDate || null,
      region: userData.region || '',
      district: userData.district || '',
      avatar: userData.avatar || null,
      rank: userData.rank || getRank(userData.points || 0),
      age: calculateAge(userData.birthDate),
      createdAt: userData.createdAt || null
    };
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userResponse })
    };
    
  } catch (error) {
    console.error('Get user error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get user' })
    };
  }
}

// Update user function
async function updateUser(userId, updateData) {
  try {
    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.loginId;
    delete updateData.password;
    delete updateData.createdAt;
    
    // Update rank based on points if points are updated
    if (updateData.points !== undefined) {
      updateData.rank = getRank(updateData.points);
    }
    
    updateData.updatedAt = new Date().toISOString();
    
    await db.collection('foydalanuvchilar').doc(userId).update(updateData);
    
    // Get updated user
    return getUser(userId);
    
  } catch (error) {
    console.error('Update user error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to update user' })
    };
  }
}

// Update avatar function
async function updateAvatar(userId, { avatar }) {
  try {
    if (!avatar) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Avatar data required' })
      };
    }
    
    // Validate base64 image
    if (!avatar.startsWith('data:image/')) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid image format' })
      };
    }
    
    // Check image size (max 2MB)
    const base64Data = avatar.split(',')[1];
    const size = Buffer.from(base64Data, 'base64').length;
    
    if (size > 2 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Image size should be less than 2MB' })
      };
    }
    
    const updateData = {
      avatar,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('foydalanuvchilar').doc(userId).update(updateData);
    
    // Get updated user
    return getUser(userId);
    
  } catch (error) {
    console.error('Update avatar error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to update avatar' })
    };
  }
}

// Change password function
async function changePassword(userId, { currentPassword, newPassword }) {
  try {
    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Joriy va yangi parol talab qilinadi' })
      };
    }
    
    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak' })
      };
    }
    
    const userDoc = await db.collection('foydalanuvchilar').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Foydalanuvchi topilmadi' })
      };
    }
    
    const userData = userDoc.data();
    
    // Check current password
    if (userData.password !== currentPassword) {
      return {
        statusCode: 401,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Joriy parol noto‘g‘ri' })
      };
    }
    
    // Update password
    await userDoc.ref.update({
      password: newPassword,
      updatedAt: new Date().toISOString()
    });
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Parol muvaffaqiyatli yangilandi' })
    };
    
  } catch (error) {
    console.error('Change password error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to change password' })
    };
  }
}