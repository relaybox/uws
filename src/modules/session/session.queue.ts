import { JobsOptions, Queue } from 'bullmq';
import { connectionOptionsIo } from '@/lib/redis';

const SESSION_QUEUE_NAME = 'session';
const SESSION_QUEUE_PREFIX = 'queue';
const RETRY_BACKOFF_RATE_MS = 500;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_TYPE = 'exponential';

const defaultQueueConfig = {
  streams: {
    events: {
      maxLen: 100
    }
  }
};

export enum SessionJobName {
  SESSION_DESTROY = 'session:destroy',
  SESSION_ACTIVE = 'session:active',
  SESSION_DISCONNECTED = 'session:disconnected',
  SESSION_USER_INACTIVE = 'session:user:inactive',
  SESSION_SOCKET_CONNECTION_EVENT = 'session:socket:connection_event',
  SESSION_HEARTBEAT = 'session:heartbeat'
}

export const defaultJobConfig: JobsOptions = {
  attempts: RETRY_MAX_ATTEMPTS,
  backoff: {
    type: RETRY_BACKOFF_TYPE,
    delay: RETRY_BACKOFF_RATE_MS
  },
  removeOnComplete: true,
  removeOnFail: false
};

export const sessionQueue = new Queue(SESSION_QUEUE_NAME, {
  connection: connectionOptionsIo,
  prefix: SESSION_QUEUE_PREFIX,
  ...defaultQueueConfig
});

sessionQueue.on('error', (err) => {
  console.log(`Session queue error`, { err });
});
