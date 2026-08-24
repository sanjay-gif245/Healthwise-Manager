// Minimal ambient typings for Node's built-in `node:sqlite` module.
// @types/node does not yet ship these (the module is still experimental),
// so we declare just the surface area this project uses.
declare module 'node:sqlite' {
  export type SQLInputValue = string | number | bigint | Uint8Array | null;
  export type SQLOutputValue = string | number | bigint | Uint8Array | null;

  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: SQLInputValue[]): StatementResultingChanges;
    // Typed as `any` deliberately: callers cast each row to a specific
    // domain row type immediately at the repository boundary (see
    // src/db/repositories/*), so a precise generic here would just be
    // fought with `as unknown as T` everywhere instead of `as T`.
    get(...params: SQLInputValue[]): any;
    all(...params: SQLInputValue[]): any[];
    iterate(...params: SQLInputValue[]): IterableIterator<any>;
    setAllowBareNamedParameters(enabled: boolean): void;
    setReadBigInts(enabled: boolean): void;
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    isOpen: boolean;
  }
}
