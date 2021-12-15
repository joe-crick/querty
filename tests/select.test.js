import cloneDeep from "clone-deep";
import { setConfig, exec } from "../src/querty.mjs";
import selectSimpleSubset from "./test-data/select/select-simple-subset.json";
import selectSimpleMultipleSubset from "./test-data/select/select-simple-multiple-subset.json";
import selectSingleUser from "./test-data/select/select-single-user.json";
import selectMultipleCondition from "./test-data/select/select-simple-subset-condition.json";
import selectAllSingle from "./test-data/select/select-all.json";
import selectAllMulti from "./test-data/select/select-all-multi.json";
import selectAllSomeMulti from "./test-data/select/select-all-some-multi.json";
import selectSimpleAlias from "./test-data/select/select-simple-alias.json";
import selectLeftJoin from "./test-data/select/select-left-join.json";
import selectInnerJoin from "./test-data/select/select-inner-join.json";
import selectMultiTableJoin from "./test-data/select/select-multi-table-join.json";
import selectAliasedSubset from "./test-data/select/select-aliased-subset.json";
import selectQueryParam from "./test-data/select/select-query-parameters.json";
import { nodeProvider } from "querty-node";

const config = {
  apiUrl: "https://jsonplaceholder.typicode.com",
  dataExtractor(data) {
    return data;
  },
  nodeProvider
};

describe("select", () => {
  it("should select a subset of data from a single endpoint", async () => {
    setConfig(config);
    const state = await exec("SELECT name, email FROM users");
    expect(state).toEqual(selectSimpleSubset);
  });
  it("should select a subset of data from a single endpoint with a conditional clause", async () => {
    setConfig(config);
    const state = await exec("SELECT name, email FROM users WHERE id = 1");
    expect(state).toEqual(selectSingleUser);
  });
  it("should select a subset of data from a single endpoint with a parameter specified for query string params", async () => {
    setConfig(config);
    const state = await exec("SELECT name, email FROM users WHERE id = 1", { page: 1 });
    expect(state).toEqual(selectSingleUser);
  });
  it("should select a subset of data from multiple endpoints", async () => {
    setConfig(config);
    const state = await exec("SELECT users.name, body, title FROM users, posts");
    expect(state).toEqual(selectSimpleMultipleSubset);
  });
  it("should select a subset of data from multiple endpoints with a conditional clause", async () => {
    const postsConfig = cloneDeep(config);
    postsConfig.pathMap = {
      posts: "users/{users.id}/posts"
    };
    setConfig(postsConfig);
    const state = await exec("SELECT users.name, title FROM users, posts WHERE users.id = 1");
    expect(state).toEqual(selectMultipleCondition);
  });
  it("should select data from an aliased endpoint clause", async () => {
    const postsConfig = cloneDeep(config);
    postsConfig.pathMap = {
      people: "users"
    };
    setConfig(postsConfig);
    const state = await exec("SELECT name, email FROM people");
    expect(state).toEqual(selectAliasedSubset);
  });
  it("should select data from an endpoint that requires an query parameters", async () => {
    const postsConfig = cloneDeep(config);
    postsConfig.pathMap = {
      comments: "comments?postId={post.id}"
    };
    setConfig(postsConfig);
    const state = await exec("SELECT name, email FROM comments WHERE post.id = 1");
    expect(state).toEqual(selectQueryParam);
  });
  it("should select all data from a single endpoint", async () => {
    setConfig(config);
    const state = await exec("SELECT * FROM users");
    expect(state).toEqual(selectAllSingle);
  });
  it("should select all data from multiple endpoints", async () => {
    setConfig(config);
    const state = await exec("SELECT * FROM users, posts");
    expect(state).toEqual(selectAllMulti);
  });
  it("should select all data from one endpoint, and a subset from another", async () => {
    setConfig(config);
    const state = await exec("SELECT users.*, title, body FROM users, posts");
    expect(state).toEqual(selectAllSomeMulti);
  });
  it("should allow aliases for column names", async () => {
    setConfig(config);
    const state = await exec("SELECT title as headline FROM posts");
    expect(state).toEqual(selectSimpleAlias);
  });
  it("should join the results of a query with an INNER join and WHERE clause", async () => {
    const postsConfig = cloneDeep(config);
    postsConfig.pathMap = {
      posts: "users/{users.id}/posts"
    };
    setConfig(postsConfig);
    const state = await exec(
      "SELECT users.name, title FROM users JOIN posts ON users.id = posts.userId WHERE users.id = 1"
    );
    expect(state).toEqual(selectInnerJoin);
  });
  it("should join the results of a query with a LEFT join", async () => {
    setConfig(config);
    const state = await exec("SELECT users.name, title FROM users LEFT JOIN posts ON users.id = posts.userId");
    expect(state).toEqual(selectLeftJoin);
  });
  it("should join the results of a query with a FULL join", async () => {
    const postsConfig = cloneDeep(config);
    postsConfig.pathMap = {
      posts: "users/{users.id}/posts"
    };
    setConfig(postsConfig);
    const state = await exec(
      "SELECT users.name, title FROM users FULL JOIN posts ON users.id = posts.userId WHERE users.id = 1"
    );
    expect(state).toEqual(selectInnerJoin);
  });
  it("should join the results of a query with a FULL join on multiple tables", async () => {
    const postsConfig = cloneDeep(config);
    postsConfig.pathMap = {
      posts: "users/{users.id}/posts",
      todos: "users/{users.id}/todos"
    };
    setConfig(postsConfig);

    const state = await exec(
      "SELECT users.name, posts.title as postTitle, todos.title, completed FROM users LEFT JOIN posts ON users.id = posts.userId " +
        "LEFT JOIN todos ON users.id = todos.userId WHERE users.id = 1"
    );
    expect(state).toEqual(selectMultiTableJoin);
  });
});
