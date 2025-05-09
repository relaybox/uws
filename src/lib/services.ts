import { TemplatedApp } from 'uWebSockets.js';
import { Pool } from 'pg';
import { Publisher } from 'rabbitmq-client';
import { Logger } from 'winston';
import AmqpManager from '@/lib/amqp-manager/amqp-manager';
import { cleanupPgPool, getPgPool } from '@/lib/pg';
import { cleanupAmqpPublisher, getPublisher } from '@/lib/publisher';
import { cleanupRedisClient, getRedisClient, RedisClient } from '@/lib/redis';
import { eventEmitter } from '@/lib/event-bus';
import { enqueueDeliveryMetrics } from '@/modules/metrics/metrics.service';
import { getLogger } from '@/util/logger';

export default class Services {
  public pgPool: Pool | null;
  public redisClient: RedisClient;
  public publisher: Publisher;
  public amqpManager: AmqpManager;

  private logger: Logger;
  private instanceId: string;
  private app: TemplatedApp;

  constructor(app: TemplatedApp, instanceId: string) {
    this.logger = getLogger('services');

    this.app = app;
    this.instanceId = instanceId;
    this.pgPool = this.getPgPool();
    this.redisClient = this.getRedisClient();
    this.publisher = this.getPublisher();
    this.amqpManager = this.getAmqpManager();
  }

  public async connect(): Promise<void> {
    try {
      await this.amqpManager.connect();
      await this.redisClient.connect();
    } catch (err: unknown) {
      this.logger.error(`Failed to connect services: ${err}`);
      throw err;
    }
  }

  public async disconnect(signal: string): Promise<void> {
    this.logger.info(`${signal} received, shutting down...`);

    const shutdownTimeout = setTimeout(() => {
      this.logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, 20000);

    try {
      await Promise.all([cleanupRedisClient(), cleanupPgPool(), cleanupAmqpPublisher()]);

      clearTimeout(shutdownTimeout);

      this.logger.info('Shutdown complete');

      process.exit(0);
    } catch (err) {
      this.logger.error('Error during shutdown', { err });
      process.exit(1);
    }
  }

  private getPgPool(): Pool | null {
    return getPgPool();
  }

  private getRedisClient(): RedisClient {
    return getRedisClient();
  }

  private getPublisher(): Publisher {
    return getPublisher();
  }

  private getAmqpManager(): AmqpManager {
    return AmqpManager.getInstance(this.app, eventEmitter, {
      instanceId: this.instanceId,
      enqueueDeliveryMetrics
    });
  }
}
