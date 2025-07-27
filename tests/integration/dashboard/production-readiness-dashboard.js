#!/usr/bin/env node

/**
 * Production Readiness Dashboard
 * 
 * Real-time dashboard for monitoring production readiness status
 * across Performance, Chaos Engineering, and Security testing systems
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import pino from 'pino';
import moment from 'moment';
import chalk from 'chalk';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

const logger = pino({
  name: 'production-dashboard',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

/**
 * Dashboard Data Aggregator
 */
class DashboardDataAggregator {
  constructor() {
    this.data = {
      lastUpdate: null,
      status: 'unknown',
      systems: {
        performance: { status: 'unknown', lastRun: null, results: null },
        chaos: { status: 'unknown', lastRun: null, results: null },
        security: { status: 'unknown', lastRun: null, results: null },
        integration: { status: 'unknown', lastRun: null, results: null }
      },
      readiness: {
        deployment: false,
        infrastructure: false,
        overall: false,
        confidence: 'unknown'
      },
      trends: {
        performance: [],
        security: [],
        chaos: []
      }
    };
  }

  async updateData() {
    logger.info('Updating dashboard data...');
    
    try {
      await this.updatePerformanceData();
      await this.updateChaosData();
      await this.updateSecurityData();
      await this.updateIntegrationData();
      await this.updateReadinessData();
      
      this.data.lastUpdate = moment().format('YYYY-MM-DD HH:mm:ss');
      this.data.status = this.calculateOverallStatus();
      
      logger.info('Dashboard data updated successfully');
      
    } catch (error) {
      logger.error('Failed to update dashboard data:', error);
      this.data.status = 'error';
    }
    
    return this.data;
  }

  async updatePerformanceData() {
    try {
      const resultsDir = join(projectRoot, 'tests/performance/results');
      await fs.ensureDir(resultsDir);
      
      const resultFiles = await glob(join(resultsDir, '*.json'));
      if (resultFiles.length > 0) {
        const latestFile = resultFiles.sort().pop();
        const results = await fs.readJson(latestFile);
        
        this.data.systems.performance = {
          status: results.success ? 'passed' : 'failed',
          lastRun: results.timestamp || moment(await fs.stat(latestFile)).format('YYYY-MM-DD HH:mm:ss'),
          results: results
        };
      }
    } catch (error) {
      logger.warn('Could not update performance data:', error.message);
      this.data.systems.performance.status = 'error';
    }
  }

  async updateChaosData() {
    try {
      const resultsDir = join(projectRoot, 'chaos-engineering/results');
      await fs.ensureDir(resultsDir);
      
      const resultFiles = await glob(join(resultsDir, '*.json'));
      if (resultFiles.length > 0) {
        const latestFile = resultFiles.sort().pop();
        const results = await fs.readJson(latestFile);
        
        this.data.systems.chaos = {
          status: results.success ? 'passed' : 'failed',
          lastRun: results.timestamp || moment(await fs.stat(latestFile)).format('YYYY-MM-DD HH:mm:ss'),
          results: results
        };
      }
    } catch (error) {
      logger.warn('Could not update chaos data:', error.message);
      this.data.systems.chaos.status = 'error';
    }
  }

  async updateSecurityData() {
    try {
      const resultsDir = join(projectRoot, 'security/results');
      await fs.ensureDir(resultsDir);
      
      const resultFiles = await glob(join(resultsDir, '*.json'));
      if (resultFiles.length > 0) {
        const latestFile = resultFiles.sort().pop();
        const results = await fs.readJson(latestFile);
        
        this.data.systems.security = {
          status: results.success ? 'passed' : 'failed',
          lastRun: results.timestamp || moment(await fs.stat(latestFile)).format('YYYY-MM-DD HH:mm:ss'),
          results: results
        };
      }
    } catch (error) {
      logger.warn('Could not update security data:', error.message);
      this.data.systems.security.status = 'error';
    }
  }

  async updateIntegrationData() {
    try {
      const resultsDir = join(projectRoot, 'tests/integration/results');
      await fs.ensureDir(resultsDir);
      
      const resultFiles = await glob(join(resultsDir, 'integration-test-results-*.json'));
      if (resultFiles.length > 0) {
        const latestFile = resultFiles.sort().pop();
        const results = await fs.readJson(latestFile);
        
        this.data.systems.integration = {
          status: results.success ? 'passed' : 'failed',
          lastRun: results.timestamp,
          results: results
        };
      }
    } catch (error) {
      logger.warn('Could not update integration data:', error.message);
      this.data.systems.integration.status = 'error';
    }
  }

  async updateReadinessData() {
    try {
      const resultsDir = join(projectRoot, 'tests/integration/results');
      
      // Check deployment readiness
      const deploymentFiles = await glob(join(resultsDir, 'deployment-readiness-*.json'));
      if (deploymentFiles.length > 0) {
        const latestFile = deploymentFiles.sort().pop();
        const results = await fs.readJson(latestFile);
        this.data.readiness.deployment = results.ready;
      }
      
      // Check infrastructure readiness
      const infrastructureFiles = await glob(join(resultsDir, 'infrastructure-readiness-*.json'));
      if (infrastructureFiles.length > 0) {
        const latestFile = infrastructureFiles.sort().pop();
        const results = await fs.readJson(latestFile);
        this.data.readiness.infrastructure = results.ready;
      }
      
      // Calculate overall readiness
      this.data.readiness.overall = (
        this.data.readiness.deployment &&
        this.data.readiness.infrastructure &&
        this.data.systems.performance.status === 'passed' &&
        this.data.systems.security.status === 'passed' &&
        this.data.systems.chaos.status === 'passed'
      );
      
      // Calculate confidence
      const passedSystems = Object.values(this.data.systems).filter(s => s.status === 'passed').length;
      const totalSystems = Object.keys(this.data.systems).length;
      
      if (passedSystems === totalSystems && this.data.readiness.deployment && this.data.readiness.infrastructure) {
        this.data.readiness.confidence = 'high';
      } else if (passedSystems >= totalSystems / 2) {
        this.data.readiness.confidence = 'medium';
      } else {
        this.data.readiness.confidence = 'low';
      }
      
    } catch (error) {
      logger.warn('Could not update readiness data:', error.message);
      this.data.readiness.confidence = 'unknown';
    }
  }

  calculateOverallStatus() {
    const systems = Object.values(this.data.systems);
    const passedCount = systems.filter(s => s.status === 'passed').length;
    const errorCount = systems.filter(s => s.status === 'error').length;
    
    if (errorCount > 0) return 'error';
    if (passedCount === systems.length) return 'passed';
    if (passedCount >= systems.length / 2) return 'warning';
    return 'failed';
  }
}

/**
 * Dashboard HTML Template
 */
function getDashboardHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Readiness Dashboard - Firemní Asistent</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Arial', sans-serif; 
            background: #0f172a; 
            color: #e2e8f0; 
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 20px;
            background: linear-gradient(135deg, #1e293b, #334155);
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header h1 { 
            color: #38bdf8; 
            margin-bottom: 10px; 
            font-size: 2.5rem;
        }
        .header .subtitle { 
            color: #94a3b8; 
            font-size: 1.1rem;
        }
        
        .status-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        
        .status-card { 
            background: #1e293b; 
            border-radius: 10px; 
            padding: 20px; 
            border-left: 4px solid #64748b;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }
        .status-card:hover { transform: translateY(-2px); }
        
        .status-card.passed { border-left-color: #22c55e; }
        .status-card.failed { border-left-color: #ef4444; }
        .status-card.warning { border-left-color: #f59e0b; }
        .status-card.error { border-left-color: #8b5cf6; }
        
        .card-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 15px; 
        }
        .card-title { 
            font-size: 1.25rem; 
            font-weight: bold; 
            color: #f8fafc;
        }
        .status-badge { 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.875rem; 
            font-weight: bold; 
            text-transform: uppercase;
        }
        .status-badge.passed { background: #22c55e; color: white; }
        .status-badge.failed { background: #ef4444; color: white; }
        .status-badge.warning { background: #f59e0b; color: white; }
        .status-badge.error { background: #8b5cf6; color: white; }
        .status-badge.unknown { background: #64748b; color: white; }
        
        .card-content { color: #cbd5e1; }
        .last-run { 
            font-size: 0.875rem; 
            color: #94a3b8; 
            margin-bottom: 10px;
        }
        
        .readiness-section { 
            background: #1e293b; 
            border-radius: 10px; 
            padding: 25px; 
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .readiness-title { 
            font-size: 1.5rem; 
            color: #38bdf8; 
            margin-bottom: 20px; 
            text-align: center;
        }
        .readiness-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
        }
        .readiness-item { 
            text-align: center; 
            padding: 15px; 
            background: #334155; 
            border-radius: 8px;
        }
        .readiness-item.ready { background: #16a34a; }
        .readiness-item.not-ready { background: #dc2626; }
        
        .overall-status { 
            text-align: center; 
            padding: 30px; 
            background: linear-gradient(135deg, #1e293b, #334155); 
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .overall-status.ready { 
            background: linear-gradient(135deg, #16a34a, #22c55e); 
        }
        .overall-status.not-ready { 
            background: linear-gradient(135deg, #dc2626, #ef4444); 
        }
        .overall-title { 
            font-size: 2rem; 
            margin-bottom: 10px; 
        }
        .overall-subtitle { 
            font-size: 1.1rem; 
            opacity: 0.9;
        }
        
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #64748b; 
            font-size: 0.875rem;
        }
        
        .loading { 
            text-align: center; 
            color: #94a3b8; 
            font-style: italic;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .pulsing { animation: pulse 2s infinite; }
    </style>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Production Readiness Dashboard</h1>
            <div class="subtitle">Firemní Asistent - Advanced Testing Systems Monitor</div>
            <div id="lastUpdate" class="last-run">Loading...</div>
        </div>
        
        <div class="status-grid" id="statusGrid">
            <div class="loading pulsing">Loading system status...</div>
        </div>
        
        <div class="readiness-section">
            <h2 class="readiness-title">Production Readiness Status</h2>
            <div class="readiness-grid" id="readinessGrid">
                <div class="loading pulsing">Loading readiness status...</div>
            </div>
        </div>
        
        <div class="overall-status" id="overallStatus">
            <div class="overall-title">System Status</div>
            <div class="overall-subtitle loading pulsing">Checking systems...</div>
        </div>
        
        <div class="footer">
            <p>Last updated: <span id="footerUpdate">Never</span> | Auto-refresh every 30 seconds</p>
        </div>
    </div>

    <script>
        const socket = io();
        
        socket.on('dashboardUpdate', (data) => {
            updateDashboard(data);
        });
        
        function updateDashboard(data) {
            document.getElementById('lastUpdate').textContent = 'Last Update: ' + (data.lastUpdate || 'Never');
            document.getElementById('footerUpdate').textContent = data.lastUpdate || 'Never';
            
            updateSystemStatus(data.systems);
            updateReadinessStatus(data.readiness);
            updateOverallStatus(data);
        }
        
        function updateSystemStatus(systems) {
            const grid = document.getElementById('statusGrid');
            grid.innerHTML = '';
            
            Object.entries(systems).forEach(([name, system]) => {
                const card = document.createElement('div');
                card.className = 'status-card ' + system.status;
                card.innerHTML = \`
                    <div class="card-header">
                        <div class="card-title">\${name.charAt(0).toUpperCase() + name.slice(1)} Testing</div>
                        <div class="status-badge \${system.status}">\${system.status}</div>
                    </div>
                    <div class="card-content">
                        <div class="last-run">Last Run: \${system.lastRun || 'Never'}</div>
                        <div>Status: \${getStatusDescription(system.status)}</div>
                    </div>
                \`;
                grid.appendChild(card);
            });
        }
        
        function updateReadinessStatus(readiness) {
            const grid = document.getElementById('readinessGrid');
            grid.innerHTML = '';
            
            const items = [
                { name: 'Deployment', ready: readiness.deployment },
                { name: 'Infrastructure', ready: readiness.infrastructure },
                { name: 'Overall', ready: readiness.overall }
            ];
            
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'readiness-item ' + (item.ready ? 'ready' : 'not-ready');
                div.innerHTML = \`
                    <div>\${item.name}</div>
                    <div>\${item.ready ? '✅ Ready' : '❌ Not Ready'}</div>
                \`;
                grid.appendChild(div);
            });
        }
        
        function updateOverallStatus(data) {
            const status = document.getElementById('overallStatus');
            const isReady = data.readiness.overall;
            
            status.className = 'overall-status ' + (isReady ? 'ready' : 'not-ready');
            status.innerHTML = \`
                <div class="overall-title">\${isReady ? '🚀 READY FOR PRODUCTION' : '⚠️ NOT READY FOR PRODUCTION'}</div>
                <div class="overall-subtitle">Confidence: \${data.readiness.confidence.toUpperCase()}</div>
            \`;
        }
        
        function getStatusDescription(status) {
            const descriptions = {
                'passed': 'All tests passed successfully',
                'failed': 'Some tests failed',
                'warning': 'Tests passed with warnings',
                'error': 'System error occurred',
                'unknown': 'Status not available'
            };
            return descriptions[status] || 'Unknown status';
        }
        
        // Request initial data
        socket.emit('requestUpdate');
    </script>
</body>
</html>
  `;
}

/**
 * Express Server Setup
 */
async function createDashboardServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server);
  
  const aggregator = new DashboardDataAggregator();
  
  // Serve dashboard HTML
  app.get('/', (req, res) => {
    res.send(getDashboardHTML());
  });
  
  // Serve static assets if needed
  app.use(express.static(join(__dirname, 'public')));
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    logger.info('Client connected to dashboard');
    
    socket.on('requestUpdate', async () => {
      try {
        const data = await aggregator.updateData();
        socket.emit('dashboardUpdate', data);
      } catch (error) {
        logger.error('Failed to send dashboard update:', error);
      }
    });
    
    socket.on('disconnect', () => {
      logger.info('Client disconnected from dashboard');
    });
  });
  
  // Auto-refresh every 30 seconds
  setInterval(async () => {
    try {
      const data = await aggregator.updateData();
      io.emit('dashboardUpdate', data);
    } catch (error) {
      logger.error('Failed to auto-update dashboard:', error);
    }
  }, 30000);
  
  return { app, server, io, aggregator };
}

/**
 * Main Function
 */
async function main() {
  const port = process.env.DASHBOARD_PORT || 3000;
  
  console.log(chalk.blue('🚀 Starting Production Readiness Dashboard'));
  console.log(chalk.blue('=' .repeat(50)));
  
  try {
    const { server } = await createDashboardServer();
    
    server.listen(port, () => {
      console.log(chalk.green(`✅ Dashboard running at http://localhost:${port}`));
      console.log(chalk.blue('Dashboard Features:'));
      console.log(chalk.blue('  • Real-time system status monitoring'));
      console.log(chalk.blue('  • Production readiness assessment'));
      console.log(chalk.blue('  • Auto-refresh every 30 seconds'));
      console.log(chalk.blue('  • WebSocket-based live updates'));
      console.log(chalk.blue('=' .repeat(50)));
      
      logger.info(`Production Readiness Dashboard started on port ${port}`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n⏹️  Shutting down dashboard...'));
      server.close(() => {
        console.log(chalk.green('✅ Dashboard stopped gracefully'));
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start dashboard:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Dashboard startup failed:', error);
    process.exit(1);
  });
}

export { createDashboardServer, DashboardDataAggregator };