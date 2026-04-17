import express from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { fail } from '../middleware/response.js';

export function initServerControlRoutes(serverControls) {
    const router = express.Router();
    const { startServer, restartServer, stopServer, getServerStatus } = serverControls;

    // Get server status
    router.get('/status', authenticate, (req, res) => {
        const status = getServerStatus ? getServerStatus() : { status: 'unknown' };
        res.json(status);
    });

    // Start server (if stopped, though if stopped API might be down... mostly for restart or if we have a separate control process)
    // Actually, if the server is stopped, this API won't be reachable. 
    // But 'restart' is useful.

    router.post('/restart', authenticate, requirePermission('admin'), async (req, res) => {
        try {
            res.json({ success: true, message: 'Server restarting...' });
            // Execute restart asynchronously to allow response to send
            setTimeout(() => {
                if (restartServer) restartServer();
            }, 1000);
        } catch (err) {
            return fail(res, 500, err.message);
        }
    });

    router.post('/stop', authenticate, requirePermission('admin'), async (req, res) => {
        try {
            res.json({ success: true, message: 'Server stopping...' });
            setTimeout(() => {
                if (stopServer) stopServer();
            }, 1000);
        } catch (err) {
            return fail(res, 500, err.message);
        }
    });

    return router;
}
