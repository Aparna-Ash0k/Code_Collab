import { InsertUserData, GetWorkspaceData, CreateFileData, CreateFileVariables, ListFilesData, ListFilesVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useInsertUser(options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, void>): UseDataConnectMutationResult<InsertUserData, undefined>;
export function useInsertUser(dc: DataConnect, options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, void>): UseDataConnectMutationResult<InsertUserData, undefined>;

export function useGetWorkspace(options?: useDataConnectQueryOptions<GetWorkspaceData>): UseDataConnectQueryResult<GetWorkspaceData, undefined>;
export function useGetWorkspace(dc: DataConnect, options?: useDataConnectQueryOptions<GetWorkspaceData>): UseDataConnectQueryResult<GetWorkspaceData, undefined>;

export function useCreateFile(options?: useDataConnectMutationOptions<CreateFileData, FirebaseError, CreateFileVariables>): UseDataConnectMutationResult<CreateFileData, CreateFileVariables>;
export function useCreateFile(dc: DataConnect, options?: useDataConnectMutationOptions<CreateFileData, FirebaseError, CreateFileVariables>): UseDataConnectMutationResult<CreateFileData, CreateFileVariables>;

export function useListFiles(vars: ListFilesVariables, options?: useDataConnectQueryOptions<ListFilesData>): UseDataConnectQueryResult<ListFilesData, ListFilesVariables>;
export function useListFiles(dc: DataConnect, vars: ListFilesVariables, options?: useDataConnectQueryOptions<ListFilesData>): UseDataConnectQueryResult<ListFilesData, ListFilesVariables>;
