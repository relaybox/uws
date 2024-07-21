import { Logger } from 'winston';
import { eventEmitter } from './event-bus';
import { Connection, Channel } from 'rabbitmq-client';
import { getLogger } from '../util/logger';
import { SocketSubscriptionEvent } from '../types/socket.types';
import ConfigManager from './config-manager';

const AMQP_QUEUE_NAME_PREFIX = 'queue';

export default class ChannelManager {
  private exchange: string;
  private channel: Channel;
  private instanceId: string | number;
  private queueCount: number;

  private logger: Logger = getLogger('channel-manager');

  constructor(instanceId: string | number) {
    this.instanceId = instanceId;
    this.exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;
    this.queueCount = ConfigManager.getInt('RABBIT_MQ_QUEUE_COUNT');

    eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, this.bindRoom.bind(this));
    eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_DELETE, this.unbindRoom.bind(this));
  }

  public async createChannel(connection: Connection): Promise<void> {
    this.channel = await connection.acquire();
    this.logger.info(`Channel initialized`);
  }

  private async bindRoom(room: string): Promise<void> {
    try {
      const routingKey = this.getBindingKey(room);
      const queueName = this.getQueueName(routingKey);

      await this.channel.queueBind({
        exchange: this.exchange,
        queue: queueName,
        routingKey
      });
    } catch (err) {
      this.logger.error(`Unable to bind queue`, { room, err });
    }
  }

  private async unbindRoom(room: string): Promise<void> {
    try {
      const routingKey = this.getBindingKey(room);
      const queueName = this.getQueueName(routingKey);

      await this.channel.queueUnbind({
        exchange: this.exchange,
        queue: queueName,
        routingKey
      });
    } catch (err) {
      this.logger.error(`Unable to unbind queue`, { room, err });
    }
  }

  private getQueueName(room: string): string {
    const queueIndex = this.getQueueIndex(room);
    return `${this.instanceId}-${AMQP_QUEUE_NAME_PREFIX}-${queueIndex}`;
  }

  private getQueueIndex(room: string): number {
    let hash = 0;
    let chr: number;

    for (let i = 0; i < room.length; i++) {
      chr = room.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return ((hash % this.queueCount) + this.queueCount) % this.queueCount;
  }

  private getBindingKey(room: string): string {
    const [appPid, namespace] = room.split(':');

    return `${appPid}.${namespace}.#`;
  }
}
