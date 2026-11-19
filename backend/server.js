
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// Middleware must run BEFORE routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'DKD Fruits Backend is running!',
  });
});

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5050;

app.listen(PORT, '0.0.0.0', () => {
  console.log('================================');
  console.log(' DKD FRUITS BACKEND');
  console.log(` Server running on port ${PORT}`);
  console.log('================================');
});
