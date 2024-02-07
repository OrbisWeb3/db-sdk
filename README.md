# @useorbis/db-sdk
 OrbisDB SDK to create, manage and query open data.

> [!WARNING]  
> This SDK is a work-in-progress and is being developed in parallel with the OrbisDB node.
> Things will change, however, the core components have been ported over from the Orbis Social SDK and should have a stable-enough interface.

## Installation

The SDK is available publicly on NPM. You can install it using your preferred package manager.

    npm install @useorbis/db-sdk

## Description
OrbisDB SDK is a client-side complement to OrbisDB - a decentralized database built on top of Ceramic.\
It inherits the DX of our TS SDK which enables simple user authentication while providing new (more generic) methods to manipulate data.

### How does this compare to @orbisclub/sdk?
`@orbisclub/sdk` is our Typescript SDK for Orbis Social from which OrbisDB was born.\
It is not compatible with the new SDK nor is there any feature parity between the two.

Orbis Social will be migrated to our new OrbisDB infrastructure once we reach stable prod.

The new SDK does not come with opinionated primitives (ie. Posts, Groups, Messages), nor does it have built-in encryption.\
OrbisDB SDK is aimed at the flexibility of data management for social, but also many other use-cases.

## API Reference

### Initialize the SDK
Initializing the SDK requires 2 gateways - one for your Ceramic node and another one for your OrbisDB.

```typescript
import { OrbisDB } from "@useorbis/db-sdk"

const db = new OrbisDB({
    ceramic: {
        gateway: "YOUR_CERAMIC_NODE_URL"
    },
    nodes: [
        {
            gateway: "YOUR_ORBIS_NODE_URL"
        }
    ]
})
```

#### Why is `nodes` argument an array?
We have plans to support connecting to multiple OrbisDB instances for fallback, load-balancing as well as automatic query rerouting. Currently, only the first node will be used and no node rotation will happen.

Ceramic gateways might be inferred from the OrbisDB node's metadata in the future, however, we want to make sure exposing the Ceramic node is optional to ensure privacy and security of your infrastructure.

### Handling errors

#### try / catch
Standard try/catch practices apply.

```typescript
let document
try{
    document = await orbis.insert(...).run()
}catch(error){
    console.log("Error", error)
}

console.log("Result", document)
```

#### catchError
This is a utility method provided by Orbis, originally implemented in Radash.
We've modified the call signature to make it more convenient for our use case.

```typescript
import { catchError } from "@useorbis/db-sdk"

const [document, error] = await catchError(
    () => orbis.insert(...).run()
)

if(error){
    console.warn("Error", error)
}

console.log("Result", document)
```

### User authentication
Authentication is handled by OrbisAuthenticators which generate the DID session in `did:pkh` (`OrbisEVMAuth`, `OrbisSolanaAuth`, `OrbisTezosAuth`) and `did:key` (`OrbisKeyDidAuth`) formats.

By default, sessions are persisted in `localStorage` and are valid for up to 3 months.\
In order to bypass this behavior, pass `{ saveSession: false }` to the `connectUser` method.

#### EVM (`did:pkh`)
```typescript
import { OrbisDB } from "@useorbis/db-sdk"
import { OrbisEVMAuth } from "@useorbis/db-sdk/auth"

// Browser provider
const provider = window.ethereum

// Ethers provider
const provider = new Wallet(...)

// Orbis Authenticator
const auth = new OrbisEVMAuth(provider)

// Authenticate the user and persist the session in localStorage
const authResult: OrbisConnectResult = await orbis.connectUser({ auth })

// Authenticate, but don't persist the session in localStorage
const authResult: OrbisConnectResult = await orbis.connectUser({ auth, saveSession: false })

// Log the result
console.log({ authResult })
```

#### KeyDid (`did:key`)
```typescript
import { OrbisDB } from "@useorbis/db-sdk"
import { OrbisKeyDidAuth } from "@useorbis/db-sdk/auth"

// Generate the seed
const seed = await OrbisKeyDidAuth.generateSeed()

// Initiate the authneticator using the generated (or persisted) seed
const auth = await OrbisKeyDidAuth.fromSeed(seed)

// Authenticate the user and persist the session in localStorage
const authResult: OrbisConnectResult = await orbis.connectUser({ auth })

// Authenticate, but don't persist the session in localStorage
const authResult: OrbisConnectResult = await orbis.connectUser({ auth, saveSession: false })

// Log the result
console.log({ authResult })
```

#### Check if a user is connected
This method always returns true/false.

```typescript
// Check if any user is connected
const connected = await orbis.isUserConnected()

// Check if a user with the specified wallet address is connected
const connected = await orbis.isUserConnected("0x00...")
```

#### Get the currently connected user
This method either returns the currently connected user (OrbisConnectResult) or false.

```typescript
// Get the currently connected user
const currentUser = await orbis.getConnectedUser()
if(!currentUser){
  // Notify the user or reconnect
  throw "There is no active user session."
}

console.log({ currentUser })
```

### Managing data
OrbisDB SDK makes creating, updating and reading data simple and consistent.\
We took inspiration from Web2 SDKs from solutions like Supabase/PostgREST, Knex, MongoDB, etc.

Operations are divided into `insert`, `update` and `select`.

All methods allow you to use friendly model names if you have them set up in the connected OrbisDB node.\
Contexts are also a Ceramic-native feature and are exposed in all data management methods.

Method chaining is being used to construct queries with all methods and a `.run()` method executes the chain.

`DELETE` statement-equivalent is WIP as we're looking to solve this at the core protocol layer.

#### `INSERT`
Inserts execute Ceramic MID writes. This has been abstracted using a query-builder interface to simplify execution and allow optimizations of the underlying calls in the future, without modifying the original interface.

##### Insert a single row
```typescript
const insertStatement = await orbis
    .insert("MODEL_ID" | "TABLE_NAME")
    .value(
        {
            column: value,
            column2: value2,
        }
    )
    // optionally, you can scope this insert to a specific context
    .context("CONTEXT_ID")

// Perform local JSON Schema validation before running the query
const validation = await insertStatement.validate()
if(!validation.valid){
    throw "Error during validation: " + validation.error
}

const [result, error] = await catchError(() => insertStatement.run())

// All runs of a statement are stored within the statement, in case you want to reuse the same statmenet
console.log(insertStatement.runs)
```

##### Insert multiple rows
```typescript
const insertStatement = await orbis
    .bulkInsert("MODEL_ID" | "TABLE_NAME")
    .values(
        {
            column: value,
            column2: value2,
        },
        {
            column: value,
            column2: value2,
        },
        ...
    )
    .value(
        {
            column: value,
            column2: value2,
        }
    )

// Perform local JSON Schema validation before running the query
const validation = await insertStatement.validate()
if(!validation.valid){
    console.error("Errors during validation", validation.errors)
    throw "Errors during validation"
}

// bulkStatements DO NOT throw in case a run partially fails
// As each insert is handled as an isolated case, you may have partial-success
const { success, errors } = await insertStatement.run()

if(errors.length){
    console.error("Errors occurred during execution", errors)
}

console.log(success)

// All runs of a statement are stored within the statement, in case you want to reuse the same statmenet
console.log(insertStatement.runs)
```

#### `UPDATE`
Updates can replace the entire row or perform shallow merging with existing data.

##### Replace a row
```typescript
// This will replace the provided row with provided values
const updateStatement = await orbis
    .update("DOCUMENT_ID")
    .replace(
        {
            column: value,
            column2: value2,
        }
    )

const [result, error] = await catchError(() => updateStatement.run())

// All runs of a statement are stored within the statement, in case you want to reuse the same statmenet
console.log(updateStatement.runs)
```

##### Update a row partially
```typescript
// This will perform a shallow merge before updating the document 
// { ...oldContent, ...newContent }
const updateStatement = await orbis
    .update("DOCUMENT_ID")
    .set(
        {
            column: value,
        }
    )

const [result, error] = await catchError(() => updateStatement.run())

// All runs of a statement are stored within the statement, in case you want to reuse the same statmenet
console.log(updateStatement.runs)
```

#### `SELECT`
Querying data is done using a custom-built query builder.\
The interface has been kept simple and familiar, as it mimics popular QB solutions such as Knex.js.

Query is being sent to the OrbisDB node in JSON format where it gets parsed and executed.

You can preview the final query by using `.build()`.

##### Why a custom query builder?
Our initial POCs were using existing QB solutions such as Knex.js and waterfall/JSON SQL builders.\
However, these libraries are built with backend environments in mind and made our query interface more complex, as we aren't executing queries against a DB engine directly.

Building a custom QB gave us the option to separate query building, serializing and final SQL outputs.\
It also allows us to expose custom options such as `.context()` and `.contexts()`, further abstracting the underlying data model and making future optimizations and changes in the node easier.

We also did not require multiple engine support and we kept our dependencies to the minimum.

We will keep expanding QB functionality with simple joins, new [operators](/src/querybuilder/statements/operators.ts) and other features that will make interacting with OrbisDB simpler and more efficient.

##### Building a `SELECT` query
```typescript
const selectStatement = await orbis
    // SELECT column1, column2
    // if no columns are passed, all columns (*) will be returned
    .select("column1", "column2")
    // FROM model_id | table_name | view_id
    .from("MODEL_ID" | "TABLE_NAME" | "VIEW_ID")
    // WHERE ...conditions
    // unless specified, all conditions will be treated as logical AND
    .where(
        {
            // column = "value"
            column: "value",
            // columns2 in (value1, value2)
            column2 = ["value1", "value2"]
        }
    )
    // you can scope this query to a specific context
    .context("CONTEXT_ID")
    // or multiple contexts
    .contexts("CONTEXT_ID", "CONTEXT_ID", ...)
    // ORDER BY
    .orderBy(
        // orderBy a single column
        ["column", "asc" | "desc"]
        // orderBy multiple columns
        [
            ["column1", "asc" | "desc"], 
            ["column2", "asc" | "desc"]
        ]
    )
    // LIMIT
    .limit(number)
    // OFFSET
    .offset(number)

const query = selectStatement.build()
console.log("Query that will be run", query)

const [result, error] = await catchError(() => selectStatement.run())
if(error){
    throw error
}

// columns: Array<string>
// rows: Array<T | Record<string, any>>
const { columns, rows } = result

console.log({ columns, rows })
```

##### Using operators
[Operator helpers](/src/querybuilder/statements/operators.ts) are exposed to provide query flexibility.\
These include logical, comparison and aggregation operators.

You can find the entire list of operators and resulting queries [here](/src/querybuilder/statements/operators.ts).

```typescript
import { count, sum, contains, ilike, or, gte } from "@useorbis/db-sdk/operators"

const selectStatement = await orbis
    // if no columns are passed, all columns (*) will be returned
    .select(
        "column1", 
        "column2", 
        sum("column3"), 
        count("column4", "count_column4")
    )
    .from("MODEL_ID" | "TABLE_NAME" | "VIEW_ID")
    // unless specified, all conditions will be treated as logical AND
    .where(
        {
            // column = "value"
            column: "value",
            // columns2 in ("value1", "value2")
            column2 = ["value1", "value2"],
            // column3 ILIKE "%value"
            column3: ilike("%value"),
            // column4 LIKE "%value%"
            column4: contains("value"),
            // column5 >= 5
            column5: gte(5),
            // column = "value" OR column2 = "value2"
            ...or(
                {
                    column: "value"
                },
                {
                    column2: "value2"
                }
            )
        }
    )

const query = selectStatement.build()
console.log("Query that will be run", query)

const [result, error] = await catchError(() => selectStatement.run())
if(error){
    throw error
}

// columns: Array<string>
// rows: Array<T | Record<string, any>>
const { columns, rows } = result

console.log({ columns, rows })
```