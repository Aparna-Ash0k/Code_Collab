const { User, Activity } = require('../models/User');

// Shared user storage
const users = new Map();
const activities = [];

// Demo users initialization
const initializeDemoUsers = async () => {
  try {
    const demoUsersData = [
      {
        id: '1',
        name: 'Admin User',
        email: 'admin@codecollab.com',
        role: 'admin'
      },
      {
        id: '2',
        name: 'Demo User',
        email: 'user@codecollab.com',
        role: 'user'
      },
      {
        id: 'test-user-123',
        name: 'Test User',
        email: 'test@codecollab.com',
        role: 'user'
      },
      {
        id: 'TxJtbkDRVhX31agkc22YbQwRQj72',
        name: 'Donquixote Doflamingo',
        email: 'doffy074@gmail.com',
        role: 'user'
      },
      {
        id: 'codecollab-user',
        name: 'CodeCollab Test',
        email: 'codecollab33@gmail.com',
        role: 'user'
      }
    ];

    for (const userData of demoUsersData) {
      const user = new User(userData);
      // Set password based on email
      let password = 'user123';
      if (userData.email === 'admin@codecollab.com') {
        password = 'admin123';
      } else if (userData.email === 'ashishjacobinmca@gmail.com') {
        password = 'Demo1234!';
      } else if (userData.email === 'codecollab33@gmail.com') {
        password = 'CodeCollabPassword0.';
      }
      
      await user.hashPassword(password);
      users.set(user.email, user);
    }
    
    console.log('✅ Shared demo users initialized:', Array.from(users.keys()));
  } catch (error) {
    console.error('❌ Error initializing demo users:', error);
  }
};

// Initialize demo users immediately
initializeDemoUsers();

module.exports = {
  users,
  activities,
  initializeDemoUsers
};
