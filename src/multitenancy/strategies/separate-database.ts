/**
 * Separate Database Tenant Strategy
 * 
 * Each tenant has its own dedicated database.
 * This provides the highest level of isolation and security.
 * 
 * Pros:
 * - Maximum data isolation
 * - Tenant-specific performance tuning
 * - Independent backups and restores
 * - Easier compliance with data residency requirements
 * 
 * Cons:
 * - Highest infrastructure cost
 * - More complex database management
 * - Schema updates require coordination across databases
 */

import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../../core/types';
import { TenantStrategy } from '../manager';

export interface SeparateDatabaseConfig {
  masterDatabaseUrl: string;
  databaseUrlTemplate?: string;
  maxConnections?: number;
  cacheTtl?: number;
}

export class SeparateDatabaseStrategy implements TenantStrategy {
  public readonly name = 'separate_database';
  private masterDatabaseUrl: string;
  private databaseUrlTemplate: string;
  private maxConnections: number;
  private cacheTtl: number;
  private tenantCache: Map<string, TenantContext> = new Map();
  private prismaClients: Map<string, PrismaClient> = new Map();
  private masterClient: PrismaClient;

  constructor(config: SeparateDatabaseConfig) {
    this.masterDatabaseUrl = config.masterDatabaseUrl;
    // Template for tenant database URLs (e.g., postgresql://user:pass@host:5432/tenant_{tenantId})
    this.databaseUrlTemplate = config.databaseUrlTemplate || this.masterDatabaseUrl.replace(/\/[^/]+$/, '/tenant_{tenantId}');
    this.maxConnections = config.maxConnections || 10;
    this.cacheTtl = config.cacheTtl || 5 * 60 * 1000; // 5 minutes default

    // Master client for tenant management
    this.masterClient = new PrismaClient({
      datasources: {
        db: {
          url: this.masterDatabaseUrl,
        },
      },
    });
  }

  /**
   * Get Prisma client for specific tenant database
   */
  public async getPrismaClient(tenantId: string): Promise<PrismaClient> {
    // Check if client already exists in cache
    if (this.prismaClients.has(tenantId)) {
      return this.prismaClients.get(tenantId)!;
    }

    // Validate tenant exists
    const isValid = await this.validateTenant(tenantId);
    if (!isValid) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    // Get database URL for tenant
    const context = await this.getTenantContext(tenantId);
    if (!context || !context.database) {
      throw new Error(`No database configured for tenant: ${tenantId}`);
    }

    // Create new Prisma client with tenant's database URL
    const client = new PrismaClient({
      datasources: {
        db: {
          url: context.database,
        },
      },
    });

    // Test connection
    try {
      await client.$connect();
    } catch (error) {
      console.error(`Failed to connect to database for tenant ${tenantId}:`, error);
      throw new Error(`Database connection failed for tenant ${tenantId}`);
    }

    // Cache the client
    this.prismaClients.set(tenantId, client);

    // Implement connection pool limit
    if (this.prismaClients.size > this.maxConnections) {
      await this.evictOldestClient();
    }

    return client;
  }

  /**
   * Resolve tenant ID from request
   */
  public async resolveTenantId(request: Request): Promise<string | null> {
    // Try to get from URL params (e.g., /api/tenants/:tenantId/...)
    if (request.params.tenantId) {
      return request.params.tenantId;
    }

    // Try to get from query params
    if (request.query.tenantId && typeof request.query.tenantId === 'string') {
      return request.query.tenantId;
    }

    // Try to get from user context (if authenticated)
    const user = (request as any).user;
    if (user && user.tenant_id) {
      return user.tenant_id;
    }

    return null;
  }

  /**
   * Validate if tenant exists and is active
   */
  public async validateTenant(tenantId: string): Promise<boolean> {
    try {
      const tenant = await (this.masterClient as any).tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, isActive: true },
      });

      return tenant && tenant.isActive;
    } catch (error) {
      console.error(`Error validating tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Get tenant context with database URL
   */
  public async getTenantContext(tenantId: string): Promise<TenantContext | null> {
    // Check cache first
    const cached = this.tenantCache.get(tenantId);
    if (cached) {
      return cached;
    }

    try {
      const tenant = await (this.masterClient as any).tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          config: true,
          isActive: true,
        },
      });

      if (!tenant || !tenant.isActive) {
        return null;
      }

      // Get database URL from config or generate from template
      let databaseUrl = tenant.config?.databaseUrl;
      if (!databaseUrl) {
        databaseUrl = this.getDatabaseUrlForTenant(tenantId);
      }

      const context: TenantContext = {
        id: tenant.id,
        name: tenant.name,
        config: tenant.config || {},
        database: databaseUrl,
      };

      // Cache the context
      this.tenantCache.set(tenantId, context);

      // Set up cache expiry
      setTimeout(() => {
        this.tenantCache.delete(tenantId);
      }, this.cacheTtl);

      return context;
    } catch (error) {
      console.error(`Error fetching tenant context for ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Get database URL for tenant using template
   */
  private getDatabaseUrlForTenant(tenantId: string): string {
    return this.databaseUrlTemplate.replace('{tenantId}', tenantId);
  }

  /**
   * Evict oldest client when connection pool is full
   */
  private async evictOldestClient(): Promise<void> {
    const firstKey = this.prismaClients.keys().next().value;
    if (firstKey) {
      const client = this.prismaClients.get(firstKey);
      if (client) {
        await client.$disconnect();
        this.prismaClients.delete(firstKey);
      }
    }
  }

  /**
   * Create database for new tenant
   */
  public async createTenantDatabase(tenantId: string): Promise<boolean> {
    try {
      const databaseName = `tenant_${tenantId}`;
      
      // Create database
      await this.masterClient.$executeRawUnsafe(
        `CREATE DATABASE "${databaseName}"`
      );

      // Get database URL for new database
      const databaseUrl = this.getDatabaseUrlForTenant(tenantId);

      // Create Prisma client for new database
      const newClient = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      });

      // Run migrations on new database
      // Note: You'll need to implement migration logic here
      // This typically involves running Prisma migrations against the new database

      await newClient.$disconnect();

      // Store database URL in tenant config
      await (this.masterClient as any).tenant.update({
        where: { id: tenantId },
        data: {
          config: {
            databaseUrl,
          },
        },
      });

      return true;
    } catch (error) {
      console.error(`Error creating database for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Drop database for tenant (use with extreme caution!)
   */
  public async dropTenantDatabase(tenantId: string): Promise<boolean> {
    try {
      const databaseName = `tenant_${tenantId}`;
      
      // Disconnect client if exists
      const client = this.prismaClients.get(tenantId);
      if (client) {
        await client.$disconnect();
        this.prismaClients.delete(tenantId);
      }

      // Terminate existing connections to the database
      await this.masterClient.$executeRawUnsafe(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${databaseName}'
          AND pid <> pg_backend_pid()
      `);

      // Drop database
      await this.masterClient.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${databaseName}"`
      );

      // Clear cache
      this.tenantCache.delete(tenantId);

      return true;
    } catch (error) {
      console.error(`Error dropping database for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Backup tenant database
   */
  public async backupTenantDatabase(tenantId: string, backupPath: string): Promise<boolean> {
    try {
      // This is a placeholder - actual implementation would use pg_dump or similar
      console.log(`Backing up database for tenant ${tenantId} to ${backupPath}`);
      
      // You would typically execute pg_dump here:
      // await exec(`pg_dump -h host -U user -d tenant_${tenantId} -f ${backupPath}`);
      
      return true;
    } catch (error) {
      console.error(`Error backing up database for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Restore tenant database from backup
   */
  public async restoreTenantDatabase(tenantId: string, backupPath: string): Promise<boolean> {
    try {
      // This is a placeholder - actual implementation would use pg_restore or similar
      console.log(`Restoring database for tenant ${tenantId} from ${backupPath}`);
      
      // You would typically execute pg_restore here:
      // await exec(`pg_restore -h host -U user -d tenant_${tenantId} ${backupPath}`);
      
      return true;
    } catch (error) {
      console.error(`Error restoring database for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Get all active tenant database connections
   */
  public getActiveTenants(): string[] {
    return Array.from(this.prismaClients.keys());
  }

  /**
   * Disconnect specific tenant
   */
  public async disconnectTenant(tenantId: string): Promise<void> {
    const client = this.prismaClients.get(tenantId);
    if (client) {
      await client.$disconnect();
      this.prismaClients.delete(tenantId);
    }
  }

  /**
   * Disconnect all tenant clients
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.prismaClients.values()).map(
      client => client.$disconnect()
    );
    
    await Promise.all(disconnectPromises);
    this.prismaClients.clear();
    
    await this.masterClient.$disconnect();
  }

  /**
   * Clear tenant cache
   */
  public clearCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantCache.delete(tenantId);
    } else {
      this.tenantCache.clear();
    }
  }

  /**
   * Health check for tenant database
   */
  public async checkTenantHealth(tenantId: string): Promise<boolean> {
    try {
      const client = await this.getPrismaClient(tenantId);
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error(`Health check failed for tenant ${tenantId}:`, error);
      return false;
    }
  }
}
