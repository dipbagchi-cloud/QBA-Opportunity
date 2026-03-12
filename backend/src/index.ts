import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import opportunitiesRoutes from './routes/opportunities.routes';
import leadsRoutes from './routes/leads.routes';
import analyticsRoutes from './routes/analytics.routes';
import approvalsRoutes from './routes/approvals.routes';
import agentsRoutes from './routes/agents.routes';
import resourcesRoutes from './routes/resources.routes';
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

// Routes
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api', agentsRoutes);  // mounts /api/agents/task and /api/agent/run
app.use('/api/resources', resourcesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
