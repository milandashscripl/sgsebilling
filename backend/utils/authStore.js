const bcrypt = require('bcryptjs');

function createAuthStore() {
  const users = [];
  let nextId = 1;

  const seedDefaultAdmin = async () => {
    const adminEmail = 'suryagharsolarenergy@gmail.com';
    const existing = users.find((user) => user.email === adminEmail);
    if (existing) {
      existing.role = 'admin';
      return existing;
    }
    if (existing) return existing;

    const hashed = await bcrypt.hash('123456', 10);
    const admin = {
      id: nextId++,
      name: 'Surya Ghar Solar Energy',
      email: adminEmail,
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

  const migrateCallers = async () => {
    const hashed = await bcrypt.hash('123456', 10);
    users.filter((user) => user.role === 'caller').forEach((user) => {
      user.email = `${String(user.name).toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
      user.password = hashed;
    });
  };

  const findUserByEmail = (email) => users.find((user) => user.email === email);
  const findUserByIdentifier = (identifier) => users.find((user) => user.email === identifier || user.name.toLowerCase() === String(identifier).toLowerCase());
  const findUserById = (id) => users.find((user) => String(user.id) === String(id));

  const updateUserById = async (id, updates) => {
    const user = findUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  };

  const createUser = async ({ name, email, password, role, ownerId = null, shopName = 'SGSE Billing', shopAddress = '', shopGSTIN = '', shopLogoUrl = '', phone = '', address = '' }) => {
    const existing = findUserByEmail(email);
    if (existing) return null;

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: nextId++,
      name,
      email,
      password: hashed,
      role: role === 'admin' ? 'admin' : role === 'caller' ? 'caller' : 'user',
      ownerId,
      shopName,
      shopAddress,
      shopGSTIN,
      shopLogoUrl,
      phone,
      address,
      appSettings: {}
    };
    users.push(user);
    return user;
  };

  return {
    users,
    seedDefaultAdmin,
    migrateCallers,
    findUserByEmail,
    findUserByIdentifier,
    findUserById,
    createUser
  };
}

const authStore = createAuthStore();

module.exports = { authStore, createAuthStore };
