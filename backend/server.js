const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD
  ? `mongodb+srv://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@cluster0.vfl7zua.mongodb.net`
  : undefined);

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'SGSE billing API is running' });
});

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const itemTypeRoutes = require('./routes/itemTypeRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/item-types', itemTypeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

if (!mongoUri) {
  console.error('Missing MongoDB connection string. Set MONGODB_URI or MONGODB_USERNAME/MONGODB_PASSWORD.');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
