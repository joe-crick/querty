# <img src='https://raw.githubusercontent.com/joe-crick/querty/master/Querty.png' height='60' alt='Querty Logo' aria-label='querty' /> Querty

## Querty is currently in _Beta_

While Querty's MVP is complete, it is still undergoing testing. If you're using it, please report any 
bugs you may find to the GitHub repo. Many thanks!

## Table of contents

- [Change the way you think about working with API Data](#change-the-way-you-think-about-working-with-api-data)
- [Use with Node](#use-with-node)
- [Defining Endpoints](#defining-endpoints)
- [Return Data](#return-data)
- [Supported SQL Features](#supported-sql-features)
- [Selects with Joins](#selects-with-joins)
- [Selecting object sets](#selecting-object-sets)
- [Column Aliasing](#column-aliasing)
- [Path Maps: Nested Routes, and Aliasing](#path-maps--nested-routes--and-aliasing)
- [Query Parameters](#query-parameters)
- [Headers and Authentication](#headers-and-authentication)
  * [Refresh Tokens](#refresh-tokens)
- [Cockatiel Policies](#cockatiel-policies)
- [Request Interception](#request-interception)
- [Debug mode](#debug-mode)
- [Cancellation](#cancellation)
- [Data Extraction](#data-extraction)
- [Pagination Tokens](#pagination-tokens)
- [Performance](#performance)
- [Addons](#addons)

### Querty A New (old) Paradigm for Data Access

All your Isomporphic (node or browser) API data needs in one, simple query:

```javascript
import { exec, setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com"
};

setConfig(config);

async function getData(id) {
  const data = await exec(`SELECT users.name, body, username FROM users, comments WHERE users.id = ${id}`);
  console.log(data);
}

getData(12);
```

**NOTE**:

Querty is designed to have a minimum of functionalty out of the box, focusing on its core value propositions, and
a few standard features. However, it is also designed to be extensible. This way, you have more control over how
you will use Querty. This also helps to keep Querty small.

For example, by default, Querty only works in the Browser. If you need to use it in Node (or have an Isomorphic http client),
you can do so quite easily. It takes only two steps. See [Use with Node](#use-with-node) for more information. 

Other options for extending Querty are detailed below (see [Addons](#addons)).

Finally, please note that Querty currently only supports working with JSON data.

#### Change the way you think about working with API Data

There are a ton of really great http clients out there, like:

- axios
- superagent
- apisauce
- needle
- etc.

And, don't forget `fetch`.

Why, yet, another HTTP client? Because it's time for a change in the way we think about REST data access.
Using a standard HTTP client, getting data from a REST API usually looks something like this example:

```javascript
const response = await axios.get(baseURL);
updateStateSomehow(response.data);
```

If all you need is two or three props from this endpoint, then your code could like this:

```javascript
const response = await axios.get(baseURL);
updateStateSomehow(
  response.data.map(({ name, age, dob }) => ({
    name,
    age,
    dob
  }))
);
```

If you have to get data from several endpoints, and combine them, it can look something like this:

```javascript
const response = await axios.get(baseURL);
const user = response.data;
const post = await axios.get(`${baseURL}/${user.id}`);
updateStateSomehow(post.data);
```

Querty aims to _change the way you think_ about working with REST API data.

What if you could, similar to GraphQL:

- work with only the data you needed?
- retrieve and manage data from multiple endpoints in one statement?
- utilise knowledge you already have, instead of learning something from scratch?

That's the motivation behind Querty. Querty is a paradigm shift in working
with REST API data. What makes Querty different?

- Rather than making calls to directly to a REST API, you simply query Querty. Querty manages all your requests, and gives you back only the data you asked for.
- You can shift your coding, and your thinking to focus from how you get the data, to getting the data you want.

Here's an example of Querty in action, using `React`:

```javascript
import { exec, setConfig } from "querty";

function App() {
  const config = {
    apiUrl: "https://my-api.com"
  };

  setConfig(config);

  useEffect(() => {
    async function load() {
      const data = await exec("SELECT users.name, body, username FROM users, comments");
      setState(data);
    }
    load();
  }, [exec, setState]);

  return (
    <div className="App">
      <div>
        <ul>
          {state.users
            ? state.users.map((user, idx) => {
                return <li key={idx}>{user.name}</li>;
              })
            : ""}
        </ul>
      </div>
    </div>
  );
}
```

One call to `exec` along with a SQL-like statement or query is all you need. Querty handles the rest.
It gets the data from the REST API, extracts the information you need, and sends the updated data to your
state management of choice.

To keep Querty small, only a subset of SQL is supported. _Querty_ versions of:

- SELECT
- INSERT
- UPDATE
- DELETE

are supported. In addition, Querty _Object syntax_ supports simplified updates and creations. Below is an example of
`UPDATE` using both supported syntax forms:

```javascript
// Update using SQL-like Syntax
await exec(`UPDATE posts SET title = 'Alfred Schmidt', body = 'Frankfurt' WHERE id = 1`);

// Update using Querty Object syntax
await exec(`UPDATE posts WHERE id = 1`, { title: "Alfred Schmidt", body: "Frankfurt" });
```

#### Use with Node

Stand alone Querty only works in the Browser. However, making Querty Isomorphic (enabling it to work in Node and the Browser)
is quite simple.

1. Install [querty-node](https://npmjs.com/package/querty-node) using pnpm: `pnpm add querty-node`.
2. Add the following to your Querty `config`:

```javascript
import { nodeProvider } from "querty-node";

const config = {
  apiUrl: "https://my-api.com",
  nodeProvider
};
```

Afer implementing this configuration, Querty will be Isomorphic.

#### Defining Endpoints

Querty supports two modes of defining endpoints:

1. Base / Default URI
2. Individual URIs

To set a base / default URI, which will be used by all queries, set the `apiUrl` property of the `config`, as below:

```javascript
const config = {
  apiUrl: "https://my-api"
};
```

Querty also supports mapping endpoints to specific URIs, a feature you can combine with the base / default URI. In the
example below, all endpoints will be mapped to `https://my-api`, except the `users` endpoint, which will be mapped to
`https://my-users-api`. Note that you can provide default `fetch` `options` in the main config, and endpoint-specific
`options` for each `path` you define:

```javascript
const options = {
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json"
  }
};

const config = {
  apiUrl: "https://my-api",
  options,
  path: {
    users: {
      url: "https://my-users-api",
      options
      }
    }
  }
};
```

Querty doesn't care where your data comes from. As long as your configuration is correct, you can select data across
different endpoints. That said, if the endpoints return data in different formats, you should configure your `dataExtractor`
to support them. An example is below:

```javascript
const config = {
  // ...
  dataExtractor(data) {
    return data.hasOwnProperty("data") ? data.data : data;
  }
};
```

#### Return Data

Querty returns data in one of two formats:

1. Raw Data: An Array of data is returned.
2. Object Sets: An object is returned containing properties that contain data related to the endpoints queried.

```javascript
// Obect Set
{
    "users": [
        {"name": "Leanne Graham", "email": "Sincere@april.biz"},
        {"name": "Ervin Howell", "email": "Shanna@melissa.tv"},
        // ...
    ]
}

// Raw Data
[
    {
        "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
        "id": 1
    },
    {
        "title": "qui est esse",
        "id": 1
    },
    // ...
]
```

#### Supported SQL Features

Querty implements a subset of SQL to provide a familiar syntax for working with REST API data. This section details the SQL commands and features supported by Querty.

##### Supported SQL Commands

Querty supports four main SQL commands, each mapped to corresponding HTTP methods:

1. **SELECT** (mapped to HTTP GET)
   - Used to retrieve data from one or more endpoints
   - Supports field selection, table selection, WHERE clauses, and JOINs

2. **INSERT** (mapped to HTTP POST)
   - Used to create new resources
   - Supports field-value pairs

3. **UPDATE** (mapped to HTTP PUT)
   - Used to modify existing resources
   - Supports field-value pairs and WHERE clauses

4. **DELETE** (mapped to HTTP DELETE)
   - Used to remove resources
   - Supports WHERE clauses

##### Command Syntax and Examples

###### SELECT

The SELECT command supports the following syntax:

```
SELECT field1, field2, ... FROM endpoint1, endpoint2, ... [WHERE condition]
```

Or with joins:

```
SELECT field1, field2, ... FROM endpoint1 [JOIN_TYPE] JOIN endpoint2 ON endpoint1.field = endpoint2.field [WHERE condition]
```

Examples:
```javascript
// Simple select
await exec("SELECT name, email FROM users");

// Select with WHERE clause
await exec("SELECT name, email FROM users WHERE id = 1");

// Select with column aliasing
await exec("SELECT title as headline FROM posts");

// Select from multiple endpoints
await exec("SELECT users.name, title FROM users, posts WHERE users.id = 1");
```

###### INSERT

The INSERT command supports the following syntax:

```
INSERT INTO endpoint (field1, field2, ...) VALUES (value1, value2, ...)
```

Example:
```javascript
await exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')");
```

###### UPDATE

The UPDATE command supports the following syntax:

```
UPDATE endpoint SET field1 = value1, field2 = value2, ... WHERE condition
```

Or using Querty Object syntax:

```
UPDATE endpoint WHERE condition
```

Examples:
```javascript
// Update using SQL-like syntax
await exec("UPDATE posts SET title = 'Alfred Schmidt', body = 'Frankfurt' WHERE id = 1");

// Update using Querty Object syntax
await exec("UPDATE posts WHERE id = 1", { title: "Alfred Schmidt", body: "Frankfurt" });
```

###### DELETE

The DELETE command supports the following syntax:

```
DELETE FROM endpoint WHERE condition
```

Example:
```javascript
await exec("DELETE FROM posts WHERE id = 1");
```

##### Supported Clauses and Features

###### WHERE Clause

The WHERE clause is supported for filtering data. It supports simple equality conditions and the IN operator (IN is parsed and exposed via conditions.operator = 'IN' and conditions.values; evaluation depends on your API or custom addons).

Example:
```javascript
await exec("SELECT name, email FROM users WHERE id = 1");
```

###### JOIN Types

Querty supports three types of joins:

- **JOIN** (Inner Join): Returns records that have matching values in both tables
- **LEFT JOIN**: Returns all records from the left table and matched records from the right table
- **FULL JOIN**: Returns all records when there is a match in either the left or right table

Example:
```javascript
await exec("SELECT users.name, title FROM users LEFT JOIN posts ON users.id = posts.userId");
```

###### Column Aliasing

Column aliasing is supported using the `AS` keyword.

Example:
```javascript
await exec("SELECT title AS headline FROM posts");
```

##### Limitations and Differences from Standard SQL

- Querty is designed for REST API data access, not for database operations
- Complex WHERE clauses with multiple conditions are not supported
- Aggregate functions (SUM, COUNT, AVG, etc.) are not supported
- HAVING clause is supported for simple predicates (equality and IN) applied after GROUP BY; aggregate functions remain unsupported
- Subqueries are not supported
- ORDER BY clause is supported for simple field sorting (ASC/DESC, multiple keys, entity-scoped fields)
- The SQL syntax is simplified and does not follow all SQL standards

#### Selects with Joins

Querty has support for performing joins. Because Join queries are an amalgamation of endpoint data, they return Raw Data.
Additionally, the `id` parameters used for joining will be automatically included in the final data.
The following join types are supported:

- Join (an Inner Join)
- Left Join
- Full Join

```javascript
const state = await exec(
  "SELECT users.name, title FROM users FULL JOIN posts ON users.id = posts.userId WHERE users.id = 1"
);
```

You can join on multiple endpoints:

```javascript
const config = {
  apiUrl: "https://my-api.com",
  pathMap: {
    posts: "users/{users.id}/posts",
    todos: "users/{users.id}/todos"
  }
};
setConfig(config);

const state = await exec(
  "SELECT users.name, posts.title as postTitle, todos.title, completed FROM users " +
    "LEFT JOIN posts ON users.id = posts.userId " +
    "LEFT JOIN todos ON users.id = todos.userId WHERE users.id = 1"
);
```

Multiple endpoint joins are left-to-right aggregated. In the example above, `users` is joined with `posts`, then the result
of that join is joined with `todos`.

#### Selecting object sets

If you select data from multiple endpoints without a JOIN clause, Querty will return an Object with the results for each endpoint scoped
to a property.

In the example below, the API is being queried for `users` and `posts` by `userId`. Here, you can see an example
of _nested path mapping_. The `posts` endpoint requires a `userId`. A path map is added to the config to
map any requests to `posts` to the correct format.

```javascript
import { exec, setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com",
  pathMap: {
    posts: "users/{users.id}/posts"
  }
};

setConfig(config);

const state = await exec("SELECT users.name, title FROM users, posts WHERE users.id = 1");

/*
 * The resulting state will look something like:
 * 
 * {
      "users": [{ "name": "Leanne Graham" }],
      "posts": [
        { "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit" },
        { "title": "qui est esse" },
       ... More results
      ]
    }
 */
```

#### Column Aliasing

Column aliasing is supported, as in the following example using `Svelte`:

```javascript
<script>
    import { onMount } from "svelte";
    import { exec, setConfig } from "querty";
    let posts = [];

    const config = {
        apiUrl: "https://my-api.com"
    };

    setConfig(config);

    onMount(async function () {
      const response = await exec("SELECT title as headline FROM posts");
      posts = response.posts;
    });

    export let name;
</script>
<main>
    {#each posts as article}
    <div>
        <p>{article.headline}</p>
    </div>
    {/each}
</main>
```

#### Path Maps: Nested Routes, and Aliasing

Querty supports nested routes:

```javascript
// This configuration sets the `posts` endpoint to expect a users.id
const config = {
  apiUrl: "https://my-api.com",
  pathMap: {
    posts: "users/{users.id}/posts"
  }
};

// The `users.id` value in the WHERE clause maps to the `{users.id} slug in the pathMap for `posts`
exec("SELECT users.name, title FROM users, posts WHERE users.id = 1");
```

Below is an example of nested routes with multiple endpoints:

```javascript
// This configuration sets the `posts` endpoint to expect a users.id
const config = {
  apiUrl: "https://my-api.com",
  path: {
    posts: { url: "https://my-posts-api.com" }
  },
  pathMap: {
    posts: "users/{users.id}/posts"
  }
};

// The `users.id` value in the WHERE clause maps to the `{users.id} slug in the pathMap for `posts`
exec("SELECT users.name, title FROM users, posts WHERE users.id = 1");
```

You can also alias a route using a path map:

```javascript
const config = {
  apiUrl: "https://my-api.com",
  pathMap: {
    people: "users"
  }
};

exec("SELECT name, email FROM people");
```

_NOTE_: If you alias a path, the result set returned will be scoped to that path. For example, the output
from the query above would be scoped to a `people` property, not a `users` property:

```javascript
{
    "people": [
        {"name": "Leanne Graham", "email": "Sincere@april.biz"},
        //...
    ]
}
```

#### Query Parameters

There are two ways of providing query parameters:

1. Using `pathMap` (supported for all `exec` types: e.g., `INSERT`, `UPDATE`, etc.):

```javascript
const config = {
  apiUrl: "https://my-api.com",
  pathMap: {
    comments: "comments?postId={post.id}"
  }
};
```

2. Passing in a Parameters Object to the `exec` function (only works with SELECT):

```javascript
exec("SELECT name, email FROM users WHERE id = 1", { page: 1, filter: "my filter param" });
```

Of the two methods, Option 2, the Parameters Object is the recommended method.

#### Headers and Authentication

You can provide any standard set of `fetch` options to Querty---which can be useful, for example,
if you need to access restricted endpoints.

```javascript
import { setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com",
  options: {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer MY-TOKEN"
    }
  }
};

setConfig(config);
```

##### Refresh Tokens

If you are working with an API that supports refresh tokens, you can provide the `config` with a
`refresh` function that will run should Querty encounter a 401 (Unauthorised) response. This function
should return a `Promise` that contains updated `config` headers. By default,
Querty will make one attempt to requery an endpoint following a 401, if a `refresh` function is
provided in the `config`. The `refresh` function takes one (optional) parameter: `entity`. If your
Querty implementation supports multiple endpoints, the `entity` parameter tells you which endpoint has
returned a 401, so you can respond appropriately.

```javascript
import { setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com",
  options: {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer MY-TOKEN"
    }
  },
  async refresh(entity) {
    // Your refresh logic here.
    return {
      ...this.options.headers,
      Authorization: "Bearer MY-NEW-TOKEN"
    };
  }
};

setConfig(config);
```

#### Cockatiel Policies

Querty supports the use of [`cockatiel` `Policies`](https://www.npmjs.com/package/cockatiel) for all requests, or specific endpoints. **NOTE**:
`cockatiel` _makes use of the Browser's `AbortSignal` and, therefore, only works in the Browser_.

```javascript
import { Policy, TimeoutStrategy } from "cockatiel";

// Global policy - will apply to all requests
const config = {
  apiUrl: "https://my-api.com",
  policy: Policy.timeout(10, TimeoutStrategy.Aggressive)
};

// Endpoint-specific policy
const config = {
  apiUrl: "https://my-api.com",
  users: {
    policy: Policy.timeout(10, TimeoutStrategy.Aggressive)
  }
};
```

A full example, using `Vue`:

```javascript
import { exec, setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com",
  policy: Policy.timeout(10, TimeoutStrategy.Aggressive)
};

setConfig(config);

const app = new Vue({
  el: "#app",
  data: {
    todos: []
  },
  mounted() {
    exec("SELECT id, title FROM todos").then((response) => {
      this.todos = response.todos;
    });
  }
});
```

#### Request Interception

Querty does not come with an interceptor built in. However, because it uses `fetch` internally, you can intercept
requests using [`fetch-intercept`](https://www.npmjs.com/package/fetch-intercept) (which,
according to the docs, also supports Node). For more information, see the `fetch-intercept` docs.

#### Debug mode

You can enable a built-in debug mode to log each request that Querty makes with fetch. When enabled, Querty prints the request URL and a safe snapshot of the fetch options just before the request is sent.

```javascript
import { exec, setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com",
  debug: true, // enable debug logging
  options: {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer <token>"
    }
  }
};

setConfig(config);

// Any request made by Querty will be logged
await exec("SELECT id, title FROM todos");
```

Example console output:

```
[querty][debug] fetch request { 
  url: "https://my-api.com/todos", 
  options: { method: "GET", headers: { ... }, signal: "[AbortSignal]" }
}
```

Notes:
- The AbortSignal is replaced with the string "[AbortSignal]" to keep logs serializable.
- If you include sensitive headers (e.g., Authorization), they will appear in the console. Prefer enabling debug only in local/dev environments.
- Debug mode applies to both Querty’s built-in fetch-based requester and when using a Node `nodeProvider`. When using a custom `nodeProvider`, Querty logs the URL and a safe snapshot of the options it passes (method, headers, body). If your provider further transforms options internally, the console output reflects the pre-transformed options.
- Disable by removing the debug property or setting `debug: false`.

#### Cancellation

You can cancel Browser-based requests by setting the `canCancel` property in the `config` to `true`. If you do this,
Querty will add an `AbortController` to the `cancelController` property on the `config`, which you can call to
abort the request, as below:

```javascript
const config = {
  apiUrl: "https://my-api.com",
  canCancel: true
};

setConfig(config);
exec("INSERT INTO posts (userId, title, body) VALUES (1, 'test title', 'another value here')").then((data) => {
  console.log(data);
});
config.cancelController.abort();
```

#### Data Extraction

By default, Querty expects that the data returned from an API will be in an immediately usable format (i.e., it can
have direct access to the data you requested). Not all APIs return data in this way. If you need to be able to format
the data returned by your API, you can provide Querty with a `dataExtractor` function in the config, as below:

```javascript
import { exec, setConfig } from "querty";

const config = {
  apiUrl: "https://my-api.com",
  dataExtractor(response) {
    return response.data;
  }
};

setConfig(config);

async function getData(id) {
  const data = await exec(`SELECT users.name, body, username " + 
    "FROM users, comments WHERE users.id = ${id}`);
  console.log(data);
}

getData(12);
```

#### Pagination Tokens

Querty can automatically handle cursor-based pagination for GET requests by storing and reusing a pagination token between calls.

How it works:
- When enabled, the first GET request runs normally. If the response includes a “next page” token (in the body or a response header), Querty stores it.
- The next GET request to the same endpoint with the same query parameters will automatically include the stored token as a query parameter.
- If a subsequent response does not include a next token while a pagination sequence is active, Querty clears the token and returns an empty array ([]) for that call to indicate that there are no more pages.

Enable and configure via setConfig:

```javascript
import { setConfig } from "querty";

setConfig({
  apiUrl: "https://api.example.com",
  options: {},
  // Configure where to read the next-page token from and how to send it
  paginationToken: {
    // The name of the query parameter Querty appends on subsequent requests
    // Alias: requestParam (either works)
    param: "cursor",

    // Option 1: Extract from JSON body using a dot path
    // e.g., { items: [...], next: "abc" } -> responsePath: "next"
    responsePath: "next"

    // Option 2: Extract from a response header
    // responseHeader: "x-next-token"

    // Option 3: Provide a function for full control
    // responsePath: ({ data, extracted, headers }) => headers.get("x-next-token") || data?.paging?.next
  }
});
```

Notes and behavior:
- Scope: Applies to GET requests when you pass a parameters object. This occurs both when using exec (SELECT with a parameters object) and when using the internal http client.
- Keying: The pagination sequence is keyed by the full request URL and the query parameters, excluding the pagination parameter itself. Changing any non-token query parameter starts a new sequence automatically.
- First vs subsequent calls: On the first call, Querty does not send a token. If a token is found in the response, it is stored. On the next call with the same shape, Querty appends the token (e.g., ?cursor=abc).
- End of pages: When a sequence is active and the response contains no token, Querty clears the stored token and returns []. Make another call to restart or continue with a new token if the server later provides one.
- Data extraction: If you provide a dataExtractor in your config, Querty will attempt token extraction from the original raw response and then from the extracted data if needed.
- Works in both environments:
  - Browser/fetch: Can read token from body or headers.
  - Node with nodeProvider: Also supported. The same rules apply; tokens are extracted from the provider’s returned data (headers are typically not available unless your provider adds them).

Examples

The snippets below use Querty’s internal http client for brevity; the same pagination behavior applies when using exec with SELECT and a parameters object.

1) Body path example (browser/fetch):
```javascript
setConfig({
  apiUrl: "https://api.example.com",
  options: {},
  dataExtractor: (d) => d.items,
  paginationToken: { param: "cursor", responsePath: "next" }
});

await http.get("users", { limit: 2 });      // -> GET /users?limit=2
await http.get("users", { limit: 2 });      // -> GET /users?limit=2&cursor=<stored-token>
```

2) Header example (browser/fetch):
```javascript
setConfig({
  apiUrl: "https://api.example.com",
  options: {},
  dataExtractor: (d) => d.items,
  paginationToken: { param: "pageToken", responseHeader: "x-next-token" }
});
```

3) Node provider example:
```javascript
const nodeProvider = async (opts) => {
  // your provider implementation
  return { status: 200, data: { items: [1], next: "NP-1" } };
};

setConfig({
  apiUrl: "https://api.example.com",
  options: {},
  nodeProvider,
  paginationToken: { param: "cursor", responsePath: "next" }
});

await http.get("entries", { q: "x" });     // -> https://api.example.com/entries?q=x
await http.get("entries", { q: "x" });     // -> https://api.example.com/entries?q=x&cursor=NP-1
```

Tips:
- Resetting: Calling setConfig(...) resets the stored pagination state.
- Non-GET requests: POST/PUT/DELETE are unaffected by pagination.
- Changing parameters: If you change a non-token query parameter or endpoint, Querty treats it as a new sequence.

#### Performance

In our preliminary tests, we found that Querty was quite performant!
In one test, it outpeformed a major http-client by 4 to 1. We'd perfer to not name names. Rather, we encourage you to test it
for yourself.

#### Addons

Querty has an API for creating addons to extend its functionality. Using an addon, you can inject functionality into
two stages:

1. Query Parsing
2. Result Set Processing

Each addon must be created as an object with two methods: `queryParser`, and `resultSetFilter`. Each method is
bound by Querty to the object it belongs to. As such, you can refer to properties on the addon using the `this`
keyword. The `queryParser` will receive and must return a properties object with three props: `fields`, `entities`,
and `conditions`. `fields` contains an array of the fields being selected. `entities` contains an array of the
`entities` (or "tables") being queried. `conditions` contains an array of the conditions applied to the query. The
`resultSetFilter` method will receive and must return a data structure containing the results of the query.

Below is an example:

```javascript
const first = {
  queryParser({ fields, entities, conditions }) {
    // Your logic here
    return { fields, entities, conditions };
  },
  resultSetFilter(resultSet) {
    // Your logic here
    return resultSet;
  }
};

const second = {
  queryParser({ fields, entities, conditions }) {
    // Your logic here
    return { fields, entities, conditions };
  },
  resultSetFilter(resultSet) {
    // Your logic here
    return resultSet;
  }
};

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  addons: [first, second]
};
```
