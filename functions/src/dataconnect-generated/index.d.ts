import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Collaboration_Key {
  userId: UUIDString;
  workspaceId: UUIDString;
  __typename?: 'Collaboration_Key';
}

export interface CreateFileData {
  file_insert: File_Key;
}

export interface CreateFileVariables {
  workspaceId: UUIDString;
  name: string;
  path: string;
  content: string;
  language?: string | null;
}

export interface File_Key {
  id: UUIDString;
  __typename?: 'File_Key';
}

export interface Folder_Key {
  id: UUIDString;
  __typename?: 'Folder_Key';
}

export interface GetWorkspaceData {
  workspaces: ({
    id: UUIDString;
    name: string;
  } & Workspace_Key)[];
}

export interface InsertUserData {
  user_insert: User_Key;
}

export interface ListFilesData {
  files: ({
    id: UUIDString;
    name: string;
    path: string;
    language?: string | null;
  } & File_Key)[];
}

export interface ListFilesVariables {
  workspaceId: UUIDString;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

export interface Workspace_Key {
  id: UUIDString;
  __typename?: 'Workspace_Key';
}

interface InsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<InsertUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<InsertUserData, undefined>;
  operationName: string;
}
export const insertUserRef: InsertUserRef;

export function insertUser(): MutationPromise<InsertUserData, undefined>;
export function insertUser(dc: DataConnect): MutationPromise<InsertUserData, undefined>;

interface GetWorkspaceRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetWorkspaceData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetWorkspaceData, undefined>;
  operationName: string;
}
export const getWorkspaceRef: GetWorkspaceRef;

export function getWorkspace(): QueryPromise<GetWorkspaceData, undefined>;
export function getWorkspace(dc: DataConnect): QueryPromise<GetWorkspaceData, undefined>;

interface CreateFileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFileVariables): MutationRef<CreateFileData, CreateFileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateFileVariables): MutationRef<CreateFileData, CreateFileVariables>;
  operationName: string;
}
export const createFileRef: CreateFileRef;

export function createFile(vars: CreateFileVariables): MutationPromise<CreateFileData, CreateFileVariables>;
export function createFile(dc: DataConnect, vars: CreateFileVariables): MutationPromise<CreateFileData, CreateFileVariables>;

interface ListFilesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListFilesVariables): QueryRef<ListFilesData, ListFilesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListFilesVariables): QueryRef<ListFilesData, ListFilesVariables>;
  operationName: string;
}
export const listFilesRef: ListFilesRef;

export function listFiles(vars: ListFilesVariables): QueryPromise<ListFilesData, ListFilesVariables>;
export function listFiles(dc: DataConnect, vars: ListFilesVariables): QueryPromise<ListFilesData, ListFilesVariables>;

