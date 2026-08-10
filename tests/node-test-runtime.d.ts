/**
 * Minimal ambient declarations for the two Node built-ins the unit tests use.
 *
 * `@types/node` is present in the tree (transitively), but it is not in this
 * project's `types` list — and pulling it in globally with a `/// <reference
 * types="node" />` would put `process`, `Buffer` and friends into the *app's*
 * type space, where they do not exist at runtime. React Native is not Node.
 *
 * So the surface the tests actually touch is declared here instead, scoped to
 * the module specifiers rather than to the global object. If a test needs more
 * of the runner's API, add it here rather than widening `tsconfig.json`.
 */

declare module 'node:test' {
  type TestFn = () => void | Promise<void>;
  type TestOptions = { skip?: boolean | string; todo?: boolean | string; only?: boolean };

  export function test(name: string, fn: TestFn): Promise<void>;
  export function test(name: string, options: TestOptions, fn: TestFn): Promise<void>;

  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: TestFn): void;
}

declare module 'node:fs' {
  // `push-channels.test.ts` reads a migration as text to check that the
  // sender's channel list still matches the constraint that governs it. Only
  // the one call, and deliberately no `process` or `path`: a relative path
  // resolves against the runner's cwd, which is the repository root, and
  // declaring `process` here would put it in the app's global type space —
  // the exact thing the note above says not to do.
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual<T>(actual: unknown, expected: T, message?: string): void;
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, regexp: RegExp, message?: string): void;
    throws(fn: () => unknown, message?: string): void;
    fail(message?: string): never;
  }

  const assert: Assert;
  export default assert;
}
