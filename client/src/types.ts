export interface FileMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileData extends FileMeta {
  content: string;
}

export interface FileStats {
  lines: number;
  words: number;
  chars: number;
}

export type SyncOpType = "delta" | "snapshot" | "metadata" | "delete";

export interface SyncOp {
  id?: number;
  fileId: string;
  type: SyncOpType;
  baseVersion: number;
  patch?: string;
  name?: string;
  contentAfter?: string;
  timestamp: number;
  retries: number;
}

export interface RejectedOp {
  fileId: string;
  reason: string;
  currentVersion?: number;
}

export interface AcceptedVersion {
  fileId: string;
  version: number;
}

export interface SyncCredentials {
  deviceId: string;
  sessionToken: string;
}

export interface SyncFileMeta {
  fileId: string;
  name: string;
  version: number;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SyncVersion {
  version: number;
  patch: string;
  timestamp: number;
  snapshot?: boolean;
}

export interface PulledFile {
  deleted?: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  versions: SyncVersion[];
}

export interface KeyBlob {
  key: string;
  type: "device" | "passphrase";
  rawKey?: number[];
  salt?: number[];
  wrappedKey?: number[];
  iterations?: number;
  createdAt: number;
}
