const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const User = require('./models/User');
const Item = require('./models/Item');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    const users = await User.find().sort({ createdAt: -1 }).limit(5).lean();
    const items = await Item.find().sort({ createdAt: -1 }).limit(5).lean();
    console.log('db-connect', mongoose.connection.readyState === 1 ? 'ok' : 'failed');
    console.log('users,' + users.length);
    users.forEach((u) => console.log(JSON.stringify({ id: String(u._id), email: u.email, name: u.name, role: u.role })));
    console.log('items,' + items.length);
    items.forEach((item) => console.log(JSON.stringify({ id: String(item._id), name: item.name, stock: item.stock, purchasePrice: item.purchasePrice, salePrice: item.salePrice })));
    await mongoose.disconnect();
  } catch (error) {
    console.error('ERR', error.message);
    process.exit(1);
  }
})();
