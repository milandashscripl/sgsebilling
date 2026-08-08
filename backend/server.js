const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5014;
const mongoUri = process.env.MONGODB_URI || (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD
  ? `mongodb+srv://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@cluster0.vfl7zua.mongodb.net`
  : undefined);
let isMongoConnected = false;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'SGSE billing API is running',
    database: isMongoConnected ? 'connected' : 'disconnected'
  });
});

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const itemTypeRoutes = require('./routes/itemTypeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/item-types', itemTypeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

const startServer = () => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

if (!mongoUri) {
  console.warn('Missing MongoDB connection string. Set MONGODB_URI or MONGODB_USERNAME/MONGODB_PASSWORD.');
  startServer();
} else {
  mongoose.set('strictQuery', false);
  mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true
  })
    .then(() => {
      isMongoConnected = true;
      console.log('MongoDB connected');
      startServer();
    })
    .catch((err) => {
      isMongoConnected = false;
      console.error('MongoDB connection error:', err.message);
      startServer();
    });

  mongoose.connection.on('connected', () => {
    isMongoConnected = true;
    console.log('MongoDB connection established');
  });

  mongoose.connection.on('error', (err) => {
    isMongoConnected = false;
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isMongoConnected = false;
    console.warn('MongoDB disconnected');
  });
}
