const bcrypt = require('bcryptjs');

function createAuthStore() {
  const users = [];
  let nextId = 1;

  const seedDefaultAdmin = async () => {
    const existing = users.find((user) => user.email === 'admin@example.com');
    if (existing) return existing;

    const hashed = await bcrypt.hash('123456', 10);
    const admin = {
      id: nextId++,
      name: 'Admin',
      email: 'admin@example.com',
      password: hashed,
      role: 'admin'
    };
    users.push(admin);
    return admin;
  };

  const findUserByEmail = (email) => users.find((user) => user.email === email);
  const findUserById = (id) => users.find((user) => user.id === id);

  const createUser = async ({ name, email, password, role }) => {
    const existing = findUserByEmail(email);
    if (existing) return null;

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: nextId++,
      name,
      email,
      password: hashed,
      role: role === 'admin' ? 'admin' : 'user'
    };
    users.push(user);
    return user;
  };

  return {
    users,
    seedDefaultAdmin,
    findUserByEmail,
    findUserById,
    createUser
  };
}

const authStore = createAuthStore();

module.exports = { authStore, createAuthStore };
