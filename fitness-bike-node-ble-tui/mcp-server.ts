#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import our Aerobike controller
import { AerobikeController } from './aerobike-controller.js';

class AerobikeMCPServer {
  private server: Server;
  private controller: AerobikeController;

  constructor() {
    this.server = new Server(
      {
        name: 'aerobike-controller',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.controller = new AerobikeController();
    this.setupToolHandlers();
    this.setupTools();
  }

  private setupTools() {
    // Define tools for MCP
    const tools: Tool[] = [
      {
        name: 'scan_aerobike',
        description: 'Scan for Aerobike devices via Bluetooth',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: {
              type: 'number',
              description: 'Scan timeout in seconds (default: 30)',
              default: 30
            }
          }
        }
      },
      {
        name: 'connect_aerobike',
        description: 'Connect to a discovered Aerobike device',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'Device ID to connect to (optional - connects to first found)',
            }
          }
        }
      },
      {
        name: 'disconnect_aerobike',
        description: 'Disconnect from the current Aerobike device',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_metrics',
        description: 'Get current bike metrics (speed, cadence, power, distance)',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'set_resistance',
        description: 'Set the resistance level on the bike',
        inputSchema: {
          type: 'object',
          properties: {
            level: {
              type: 'number',
              description: 'Resistance level (1-80)',
              minimum: 1,
              maximum: 80
            }
          },
          required: ['level']
        }
      },
      {
        name: 'get_connection_status',
        description: 'Get the current connection status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];

    // Register tools with the server
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'scan_aerobike': {
            const timeout = (args?.timeout as number) || 30;
            await this.controller.startScan(timeout);
            return {
              content: [
                {
                  type: 'text',
                  text: `Started scanning for Aerobike devices (timeout: ${timeout}s)`
                }
              ]
            };
          }

          case 'connect_aerobike': {
            const deviceId = args?.deviceId as string | undefined;
            const result = await this.controller.connectToDevice(deviceId);
            return {
              content: [
                {
                  type: 'text',
                  text: result.success 
                    ? `Successfully connected to ${result.deviceName}`
                    : `Failed to connect: ${result.error}`
                }
              ]
            };
          }

          case 'disconnect_aerobike': {
            this.controller.disconnect();
            return {
              content: [
                {
                  type: 'text',
                  text: 'Disconnected from Aerobike device'
                }
              ]
            };
          }

          case 'get_metrics': {
            const metrics = this.controller.getCurrentMetrics();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(metrics, null, 2)
                }
              ]
            };
          }

          case 'set_resistance': {
            const level = args?.level as number;
            if (!level || level < 1 || level > 80) {
              throw new Error('Resistance level must be between 1 and 80');
            }
            
            const result = await this.controller.setResistanceLevel(level);
            return {
              content: [
                {
                  type: 'text',
                  text: result.success 
                    ? `Successfully set resistance to level ${level}`
                    : `Failed to set resistance: ${result.error}`
                }
              ]
            };
          }

          case 'get_connection_status': {
            const status = this.controller.getConnectionStatus();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(status, null, 2)
                }
              ]
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      this.controller.disconnect();
      await this.server.close();
      process.exit(0);
    });
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new AerobikeMCPServer();
  server.run().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

export { AerobikeMCPServer };