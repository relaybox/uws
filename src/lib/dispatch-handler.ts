import { getLogger } from '../util/logger';
import { Logger } from 'winston';
import { ReducedSession } from '../types/session.types';
import { LatencyLog } from '../types/request.types';
import { Envelope, Publisher } from 'rabbitmq-client';
import { v4 as uuid } from 'uuid';
import ConfigManager from './config-manager';
import { Message } from '../types/data.types';

interface Dispatcher {
  dispatch: (event: string, data: any, session: ReducedSession, latancyLog: LatencyLog) => void;
}

export default class DispatchHandler {
  private exchange: string;
  private publisher: Publisher;

  private logger: Logger = getLogger('dispatch-handler');

  constructor(publisher: Publisher) {
    this.publisher = publisher;
    this.exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;
  }

  to(nspRoomId: string): Dispatcher {
    const $_self = this;

    return {
      dispatch: (event, data, session, latencyLog) => {
        return $_self.handleDispatch(nspRoomId, event, data, session, latencyLog);
      }
    };
  }

  private handleDispatch(
    nspRoomId: string,
    event: string,
    data: any,
    session: ReducedSession,
    latencyLog: LatencyLog
  ): void {
    const envelope: Envelope = {
      exchange: this.exchange,
      routingKey: this.getRoutingKey(event)
    };

    const message = this.buildMessage(nspRoomId, event, data, session, latencyLog);

    this.logger.info('Dispatching message', { nspRoomId, event });

    this.publisher.send(envelope, message);
  }

  private buildMessage(
    nspRoomId: string,
    event: string,
    data: any,
    session: ReducedSession,
    latencyLog: LatencyLog,
    global?: boolean
  ): Message {
    const requestId = uuid();

    return {
      nspRoomId,
      event,
      data,
      session,
      latencyLog,
      requestId,
      global
    };
  }

  private getRoutingKey(subscription: string): string {
    return subscription.replace(/:/g, '.');
  }
}
