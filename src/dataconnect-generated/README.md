# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetWorkspace*](#getworkspace)
  - [*ListFiles*](#listfiles)
- [**Mutations**](#mutations)
  - [*InsertUser*](#insertuser)
  - [*CreateFile*](#createfile)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetWorkspace
You can execute the `GetWorkspace` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getWorkspace(): QueryPromise<GetWorkspaceData, undefined>;

interface GetWorkspaceRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetWorkspaceData, undefined>;
}
export const getWorkspaceRef: GetWorkspaceRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getWorkspace(dc: DataConnect): QueryPromise<GetWorkspaceData, undefined>;

interface GetWorkspaceRef {
  ...
  (dc: DataConnect): QueryRef<GetWorkspaceData, undefined>;
}
export const getWorkspaceRef: GetWorkspaceRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getWorkspaceRef:
```typescript
const name = getWorkspaceRef.operationName;
console.log(name);
```

### Variables
The `GetWorkspace` query has no variables.
### Return Type
Recall that executing the `GetWorkspace` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetWorkspaceData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetWorkspaceData {
  workspaces: ({
    id: UUIDString;
    name: string;
  } & Workspace_Key)[];
}
```
### Using `GetWorkspace`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getWorkspace } from '@dataconnect/generated';


// Call the `getWorkspace()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getWorkspace();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getWorkspace(dataConnect);

console.log(data.workspaces);

// Or, you can use the `Promise` API.
getWorkspace().then((response) => {
  const data = response.data;
  console.log(data.workspaces);
});
```

### Using `GetWorkspace`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getWorkspaceRef } from '@dataconnect/generated';


// Call the `getWorkspaceRef()` function to get a reference to the query.
const ref = getWorkspaceRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getWorkspaceRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.workspaces);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.workspaces);
});
```

## ListFiles
You can execute the `ListFiles` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listFiles(vars: ListFilesVariables): QueryPromise<ListFilesData, ListFilesVariables>;

interface ListFilesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListFilesVariables): QueryRef<ListFilesData, ListFilesVariables>;
}
export const listFilesRef: ListFilesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listFiles(dc: DataConnect, vars: ListFilesVariables): QueryPromise<ListFilesData, ListFilesVariables>;

interface ListFilesRef {
  ...
  (dc: DataConnect, vars: ListFilesVariables): QueryRef<ListFilesData, ListFilesVariables>;
}
export const listFilesRef: ListFilesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listFilesRef:
```typescript
const name = listFilesRef.operationName;
console.log(name);
```

### Variables
The `ListFiles` query requires an argument of type `ListFilesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListFilesVariables {
  workspaceId: UUIDString;
}
```
### Return Type
Recall that executing the `ListFiles` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListFilesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListFilesData {
  files: ({
    id: UUIDString;
    name: string;
    path: string;
    language?: string | null;
  } & File_Key)[];
}
```
### Using `ListFiles`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listFiles, ListFilesVariables } from '@dataconnect/generated';

// The `ListFiles` query requires an argument of type `ListFilesVariables`:
const listFilesVars: ListFilesVariables = {
  workspaceId: ..., 
};

// Call the `listFiles()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listFiles(listFilesVars);
// Variables can be defined inline as well.
const { data } = await listFiles({ workspaceId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listFiles(dataConnect, listFilesVars);

console.log(data.files);

// Or, you can use the `Promise` API.
listFiles(listFilesVars).then((response) => {
  const data = response.data;
  console.log(data.files);
});
```

### Using `ListFiles`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listFilesRef, ListFilesVariables } from '@dataconnect/generated';

// The `ListFiles` query requires an argument of type `ListFilesVariables`:
const listFilesVars: ListFilesVariables = {
  workspaceId: ..., 
};

// Call the `listFilesRef()` function to get a reference to the query.
const ref = listFilesRef(listFilesVars);
// Variables can be defined inline as well.
const ref = listFilesRef({ workspaceId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listFilesRef(dataConnect, listFilesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.files);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.files);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## InsertUser
You can execute the `InsertUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
insertUser(): MutationPromise<InsertUserData, undefined>;

interface InsertUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<InsertUserData, undefined>;
}
export const insertUserRef: InsertUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
insertUser(dc: DataConnect): MutationPromise<InsertUserData, undefined>;

interface InsertUserRef {
  ...
  (dc: DataConnect): MutationRef<InsertUserData, undefined>;
}
export const insertUserRef: InsertUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the insertUserRef:
```typescript
const name = insertUserRef.operationName;
console.log(name);
```

### Variables
The `InsertUser` mutation has no variables.
### Return Type
Recall that executing the `InsertUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `InsertUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface InsertUserData {
  user_insert: User_Key;
}
```
### Using `InsertUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, insertUser } from '@dataconnect/generated';


// Call the `insertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await insertUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await insertUser(dataConnect);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
insertUser().then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `InsertUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, insertUserRef } from '@dataconnect/generated';


// Call the `insertUserRef()` function to get a reference to the mutation.
const ref = insertUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = insertUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## CreateFile
You can execute the `CreateFile` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createFile(vars: CreateFileVariables): MutationPromise<CreateFileData, CreateFileVariables>;

interface CreateFileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFileVariables): MutationRef<CreateFileData, CreateFileVariables>;
}
export const createFileRef: CreateFileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createFile(dc: DataConnect, vars: CreateFileVariables): MutationPromise<CreateFileData, CreateFileVariables>;

interface CreateFileRef {
  ...
  (dc: DataConnect, vars: CreateFileVariables): MutationRef<CreateFileData, CreateFileVariables>;
}
export const createFileRef: CreateFileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createFileRef:
```typescript
const name = createFileRef.operationName;
console.log(name);
```

### Variables
The `CreateFile` mutation requires an argument of type `CreateFileVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateFileVariables {
  workspaceId: UUIDString;
  name: string;
  path: string;
  content: string;
  language?: string | null;
}
```
### Return Type
Recall that executing the `CreateFile` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateFileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateFileData {
  file_insert: File_Key;
}
```
### Using `CreateFile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createFile, CreateFileVariables } from '@dataconnect/generated';

// The `CreateFile` mutation requires an argument of type `CreateFileVariables`:
const createFileVars: CreateFileVariables = {
  workspaceId: ..., 
  name: ..., 
  path: ..., 
  content: ..., 
  language: ..., // optional
};

// Call the `createFile()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createFile(createFileVars);
// Variables can be defined inline as well.
const { data } = await createFile({ workspaceId: ..., name: ..., path: ..., content: ..., language: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createFile(dataConnect, createFileVars);

console.log(data.file_insert);

// Or, you can use the `Promise` API.
createFile(createFileVars).then((response) => {
  const data = response.data;
  console.log(data.file_insert);
});
```

### Using `CreateFile`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createFileRef, CreateFileVariables } from '@dataconnect/generated';

// The `CreateFile` mutation requires an argument of type `CreateFileVariables`:
const createFileVars: CreateFileVariables = {
  workspaceId: ..., 
  name: ..., 
  path: ..., 
  content: ..., 
  language: ..., // optional
};

// Call the `createFileRef()` function to get a reference to the mutation.
const ref = createFileRef(createFileVars);
// Variables can be defined inline as well.
const ref = createFileRef({ workspaceId: ..., name: ..., path: ..., content: ..., language: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createFileRef(dataConnect, createFileVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.file_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.file_insert);
});
```

