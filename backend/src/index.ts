import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Cast express.json() result to RequestHandler to resolve "No overload matches this call" due to strict type mismatch
app.use(express.json({ limit: '10mb' }) as unknown as express.RequestHandler);

// Routes
// Remove explicit type annotations for req/res to rely on correct inference from app.get()
// This fixes "Property 'json' does not exist on type 'Response'"
app.get('/', (req, res) => {
  res.json({ message: 'Cyber Advisor Backend is running 🚀' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});