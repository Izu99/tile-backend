const { Server } = require('socket.io');
require('colors');

class WebSocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> socketId mapping
    }

    /**
     * Initialize Socket.io with HTTP server
     */
    initialize(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: "*", // Configure this properly for production
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });

        this.setupEventHandlers();
        console.log('🔌 WebSocket service initialized'.green);
    }

    /**
     * Setup Socket.io event handlers
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔗 Client connected: ${socket.id}`.cyan);

            // Handle user authentication/identification
            socket.on('authenticate', (data) => {
                try {
                    const { userId, userRole, companyName } = data;
                    
                    if (userId) {
                        // Store user mapping
                        this.connectedUsers.set(userId, socket.id);
                        socket.userId = userId;
                        socket.userRole = userRole;
                        
                        // Join user-specific room
                        socket.join(`user_${userId}`);
                        
                        console.log(`✅ User authenticated: ${companyName || 'Unknown'} (${userId}) - Socket: ${socket.id}`.green);
                        
                        // Send authentication confirmation
                        socket.emit('authenticated', {
                            success: true,
                            message: 'Successfully authenticated for real-time updates',
                            userId: userId
                        });
                    }
                } catch (error) {
                    console.error('❌ Authentication error:', error.message.red);
                    socket.emit('authentication_error', {
                        success: false,
                        message: 'Authentication failed'
                    });
                }
            });

            // Handle dashboard subscription
            socket.on('subscribe_dashboard', (data) => {
                try {
                    const { period = 'last30days' } = data;
                    socket.dashboardPeriod = period;
                    
                    if (socket.userId) {
                        socket.join(`dashboard_${socket.userId}_${period}`);
                        console.log(`📊 Dashboard subscription: User ${socket.userId} subscribed to ${period}`.cyan);
                        
                        socket.emit('dashboard_subscribed', {
                            success: true,
                            period: period,
                            message: 'Subscribed to dashboard updates'
                        });
                    }
                } catch (error) {
                    console.error('❌ Dashboard subscription error:', error.message.red);
                }
            });

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                if (socket.userId) {
                    this.connectedUsers.delete(socket.userId);
                    console.log(`🔌 User disconnected: ${socket.userId} - Reason: ${reason}`.yellow);
                } else {
                    console.log(`🔌 Client disconnected: ${socket.id} - Reason: ${reason}`.gray);
                }
            });

            // Handle ping/pong for connection health
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: Date.now() });
            });
        });
    }

    /**
     * 🔥 REAL-TIME DASHBOARD UPDATES
     * Emit dashboard update event to specific user
     */
    emitDashboardUpdate(userId, updateData = {}) {
        try {
            if (!this.io) {
                console.log('⚠️  WebSocket not initialized, skipping dashboard update'.yellow);
                return false;
            }

            const socketId = this.connectedUsers.get(userId);
            
            if (socketId) {
                // Emit to user-specific room
                this.io.to(`user_${userId}`).emit('dashboard_update', {
                    type: 'dashboard_refresh',
                    timestamp: new Date().toISOString(),
                    message: 'Dashboard data has been updated',
                    ...updateData
                });

                console.log(`📡 Dashboard update sent to user ${userId} (Socket: ${socketId})`.green);
                return true;
            } else {
                console.log(`📡 User ${userId} not connected, skipping dashboard update`.gray);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to emit dashboard update:', error.message.red);
            return false;
        }
    }

    /**
     * 🔥 SUPER ADMIN NOTIFICATIONS
     * Emit notifications to super admin users
     */
    emitSuperAdminUpdate(updateData = {}) {
        try {
            if (!this.io) {
                console.log('⚠️  WebSocket not initialized, skipping super admin update'.yellow);
                return false;
            }

            // Find all connected super admin users
            const superAdminSockets = [];
            this.io.sockets.sockets.forEach((socket) => {
                if (socket.userRole === 'super-admin') {
                    superAdminSockets.push(socket.id);
                }
            });

            if (superAdminSockets.length > 0) {
                // Emit to all super admin users
                superAdminSockets.forEach(socketId => {
                    this.io.to(socketId).emit('super_admin_update', {
                        type: 'stats_refresh',
                        timestamp: new Date().toISOString(),
                        message: 'Super admin dashboard data has been updated',
                        ...updateData
                    });
                });

                console.log(`📡 Super admin update sent to ${superAdminSockets.length} admin(s)`.green);
                return true;
            } else {
                console.log(`📡 No super admin users connected, skipping update`.gray);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to emit super admin update:', error.message.red);
            return false;
        }
    }

    /**
     * 🔥 TRANSACTION NOTIFICATIONS
     * Emit specific transaction events (quotation created, invoice paid, etc.)
     */
    emitTransactionUpdate(userId, transactionType, transactionData = {}) {
        try {
            if (!this.io) return false;

            const socketId = this.connectedUsers.get(userId);
            
            if (socketId) {
                this.io.to(`user_${userId}`).emit('transaction_update', {
                    type: transactionType,
                    timestamp: new Date().toISOString(),
                    data: transactionData
                });

                console.log(`📡 Transaction update (${transactionType}) sent to user ${userId}`.green);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Failed to emit transaction update:', error.message.red);
            return false;
        }
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        if (!this.io) {
            return { connected: 0, rooms: 0 };
        }

        return {
            connected: this.connectedUsers.size,
            totalSockets: this.io.sockets.sockets.size,
            rooms: this.io.sockets.adapter.rooms.size,
            connectedUsers: Array.from(this.connectedUsers.keys())
        };
    }

    /**
     * Broadcast system-wide message (maintenance, updates, etc.)
     */
    broadcastSystemMessage(message, type = 'info') {
        try {
            if (!this.io) return false;

            this.io.emit('system_message', {
                type: type,
                message: message,
                timestamp: new Date().toISOString()
            });

            console.log(`📢 System message broadcasted: ${message}`.cyan);
            return true;
        } catch (error) {
            console.error('❌ Failed to broadcast system message:', error.message.red);
            return false;
        }
    }
}

// Export singleton instance
const webSocketService = new WebSocketService();
module.exports = webSocketService;