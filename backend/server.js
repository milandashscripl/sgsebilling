const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// Change this line to include your new Vercel frontend URL:

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

const allowedOrigins = [
  'https://sgsebillings.netlify.app',
  'https://sgsebillings.vercel.app',
  'https://sgsebilling.vercel.app',
  'https://sgsebilling.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  }
}));
app.options('*', cors({ origin: allowedOrigins }));
const PORT = Number(process.env.PORT || 5001);
const mongoUri = process.env.MONGODB_URI || (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD
  ? `mongodb+srv://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@cluster0.vfl7zua.mongodb.net`
  : undefined);
let isMongoConnected = false;
let mongoMode = 'none';

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: 'SGSE billing API is running',
    database: isMongoConnected ? 'connected' : 'disconnected',
    mode: mongoMode
  });
});

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const itemTypeRoutes = require('./routes/itemTypeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const accountingRoutes = require('./routes/accountingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const setupRoutes = require('./routes/setupRoutes');
const { authStore } = require('./utils/authStore');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/item-types', itemTypeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/setups', setupRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const startServer = () => {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing process and try again.`);
      process.exit(1);
    }
    throw err;
  });
};

const connectToDatabase = async () => {
  mongoose.set('strictQuery', false);

  if (!mongoUri) {
    console.warn('No MongoDB URI configured. Starting in local mode without a database.');
    mongoMode = 'local';
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    isMongoConnected = true;
    mongoMode = 'atlas';
    console.log('MongoDB connected');
  } catch (err) {
    isMongoConnected = false;
    console.error('MongoDB connection error:', err.message);
    if (process.env.MONGODB_URI) {
      console.error('MongoDB URI is configured, but connection failed. Exiting so the service does not run in local-memory mode.');
      process.exit(1);
    }
    console.warn('No MongoDB connection available. Starting in local mode without a database.');
    mongoMode = 'local';
  }
};

(async () => {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error('Database bootstrap failed:', err.message);
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const existingAdmin = await User.findOne({ email: 'admin@example.com' });
      if (!existingAdmin) {
        const hashed = await bcrypt.hash('123456', 10);
        await User.create({
          name: 'Admin',
          email: 'admin@example.com',
          password: hashed,
          role: 'admin'
        });
      }
    } else {
      await authStore.seedDefaultAdmin();
    }
  } catch (err) {
    console.error('Admin seed failed:', err.message);
  }

  startServer();
})();

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
