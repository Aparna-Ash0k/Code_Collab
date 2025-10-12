import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'v2',
  location: 'us-central1'
};

export const insertUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'InsertUser');
}
insertUserRef.operationName = 'InsertUser';

export function insertUser(dc) {
  return executeMutation(insertUserRef(dc));
}

export const getWorkspaceRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetWorkspace');
}
getWorkspaceRef.operationName = 'GetWorkspace';

export function getWorkspace(dc) {
  return executeQuery(getWorkspaceRef(dc));
}

export const createFileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateFile', inputVars);
}
createFileRef.operationName = 'CreateFile';

export function createFile(dcOrVars, vars) {
  return executeMutation(createFileRef(dcOrVars, vars));
}

export const listFilesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListFiles', inputVars);
}
listFilesRef.operationName = 'ListFiles';

export function listFiles(dcOrVars, vars) {
  return executeQuery(listFilesRef(dcOrVars, vars));
}

