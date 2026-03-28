import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import opportunitiesRoutes from './routes/opportunities.routes';
import leadsRoutes from './routes/leads.routes';
import analyticsRoutes from './routes/analytics.routes';
import approvalsRoutes from './routes/approvals.routes';
import agentsRoutes from './routes/agents.routes';
import resourcesRoutes from './routes/resources.routes';
import rateCardsRoutes from './routes/rate-cards.routes';
import masterDataRoutes from './routes/master-data.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import contactsRoutes from './routes/contacts.routes';
import { getPublicStats } from './controllers/public.controller';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());

// Auth routes (public + protected)
app.use('/api/auth', authRoutes);

// Public stats for landing page (no auth)
app.get('/api/public/stats', getPublicStats);

// Admin routes (protected, Admin-only)
app.use('/api/admin', adminRoutes);

// Protected API routes
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api', agentsRoutes);  // mounts /api/agents/task and /api/agent/run
app.use('/api/resources', resourcesRoutes);
app.use('/api/rate-cards', rateCardsRoutes);
app.use('/api/master', masterDataRoutes);
app.use('/api/contacts', contactsRoutes);

// Health check (public)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
