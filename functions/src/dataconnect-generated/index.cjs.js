const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'v2',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const insertUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'InsertUser');
}
insertUserRef.operationName = 'InsertUser';
exports.insertUserRef = insertUserRef;

exports.insertUser = function insertUser(dc) {
  return executeMutation(insertUserRef(dc));
};

const getWorkspaceRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetWorkspace');
}
getWorkspaceRef.operationName = 'GetWorkspace';
exports.getWorkspaceRef = getWorkspaceRef;

exports.getWorkspace = function getWorkspace(dc) {
  return executeQuery(getWorkspaceRef(dc));
};

const createFileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateFile', inputVars);
}
createFileRef.operationName = 'CreateFile';
exports.createFileRef = createFileRef;

exports.createFile = function createFile(dcOrVars, vars) {
  return executeMutation(createFileRef(dcOrVars, vars));
};

const listFilesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListFiles', inputVars);
}
listFilesRef.operationName = 'ListFiles';
exports.listFilesRef = listFilesRef;

exports.listFiles = function listFiles(dcOrVars, vars) {
  return executeQuery(listFilesRef(dcOrVars, vars));
};
