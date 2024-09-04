import { DsPermissions } from './permissions.types';

export interface AuthUser {
  id: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  orgId: string;
  isOnline: boolean;
  lastOnline: string;
}

export interface Session {
  uid: string;
  appPid: string;
  orgId: string;
  keyId: string;
  clientId: string;
  exp: number;
  timestamp: string;
  permissions: DsPermissions;
  anonymous: boolean;
  connectionId: string;
  socketId: string;
  user?: AuthUser;
}

export interface ReducedSession {
  appPid: string;
  keyId: string;
  uid: string;
  clientId: string;
  connectionId: string;
  socketId: string;
  instanceId?: string | number;
  user?: AuthUser;
}
