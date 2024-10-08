import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { getHeader, getJsonResponse, parseRequestBody } from '@/util/http';
import { getLogger } from '@/util/logger';
import { v4 as uuid } from 'uuid';
import { RedisClient } from '@/lib/redis';
import { Pool, PoolClient } from 'pg';
import AmqpManager from '@/lib/amqp-manager';
import {
  getLatencyLog,
  getPermissions,
  getSecretKey,
  verifySignature,
  verifyTimestamp
} from './events.service';
import { DsPermission } from '@/types/permissions.types';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { getNspEvent, getNspRoomId } from '@/util/helpers';
import { addRoomHistoryMessage } from '../history/history.service';

const logger = getLogger('event');

const MAX_TIMESTAMP_DIFF_SECS = 30;

export async function handleClientEvent(
  pgPool: Pool,
  redisClient: RedisClient,
  res: HttpResponse,
  req: HttpRequest
): Promise<void> {
  let aborted = false;
  let pgClient: PoolClient | undefined;

  res.onAborted(() => {
    aborted = true;
  });

  const requestId = uuid();

  logger.info('Publishing event', { requestId });

  try {
    const publicKey = getHeader(req, `X-Ds-Public-Key`);
    const signature = getHeader(req, `X-Ds-Req-Signature`);

    if (!publicKey || !signature) {
      res.cork(() => {
        getJsonResponse(res, '400 Bad Request').end(
          JSON.stringify({
            name: 'BadRequestError',
            message: 'Public key and signature headers are required',
            data: {
              requestId
            }
          })
        );
      });

      return;
    }

    const body = await parseRequestBody(res);

    // Capture all necessary request data (like headers) before introducing any async code.
    // Reference: https://github.com/uNetworking/uWebSockets.js/discussions/84

    pgClient = await pgPool.connect();

    const [appPid, keyId] = publicKey.split('.');
    const secretKey = await getSecretKey(logger, pgClient, appPid, keyId);

    await verifySignature(body, signature, secretKey);

    const { event, roomId, data, timestamp } = JSON.parse(body);
    const verifiedTimestamp = verifyTimestamp(timestamp, MAX_TIMESTAMP_DIFF_SECS);
    const permissions = await getPermissions(logger, pgClient, keyId);

    permissionsGuard(roomId, DsPermission.PUBLISH, permissions);

    const latencyLog = getLatencyLog(timestamp);
    const nspRoomId = getNspRoomId(appPid, roomId);
    const nspEvent = getNspEvent(nspRoomId, event);

    const sender = {
      clientId: null,
      connectionId: null,
      user: null
    };

    const session = {
      appPid,
      keyId,
      uid: null,
      clientId: null,
      connectionId: null,
      socketId: null
    };

    const extendedMessageData = {
      body: data,
      sender,
      timestamp: new Date().getTime(),
      event
    };

    const amqpManager = AmqpManager.getInstance();

    amqpManager.dispatchHandler
      .to(nspRoomId)
      .dispatch(nspEvent, extendedMessageData, session, latencyLog);

    await addRoomHistoryMessage(redisClient, nspRoomId, extendedMessageData);

    if (!aborted) {
      res.cork(() => {
        getJsonResponse(res, '200 ok').end(
          JSON.stringify({
            requestId,
            timestamp: verifiedTimestamp
          })
        );
      });

      return;
    }
  } catch (err: any) {
    logger.error(`Failed to publish event`, { err });

    if (!aborted) {
      res.cork(() => {
        getJsonResponse(res, '400 Bad Request').end(
          JSON.stringify({ status: 500, message: err.message })
        );
      });

      return;
    }
  } finally {
    if (pgClient) {
      pgClient.release();
    }
  }
}
