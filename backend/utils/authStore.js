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
      role: 'admin',
      shopName: 'SGSE Billing',
      shopAddress: '',
      shopGSTIN: '',
      shopLogoUrl: '',
      phone: '',
      address: ''
    };
    users.push(admin);
    return admin;
  };

  const findUserByEmail = (email) => users.find((user) => user.email === email);
  const findUserById = (id) => users.find((user) => String(user.id) === String(id));

  const updateUserById = async (id, updates) => {
    const user = findUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  };

  const createUser = async ({ name, email, password, role, shopName = 'SGSE Billing', shopAddress = '', shopGSTIN = '', shopLogoUrl = '', phone = '', address = '' }) => {
    const existing = findUserByEmail(email);
    if (existing) return null;

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: nextId++,
      name,
      email,
      password: hashed,
      role: role === 'admin' ? 'admin' : 'user',
      shopName,
      shopAddress,
      shopGSTIN,
      shopLogoUrl,
      phone,
      address
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
