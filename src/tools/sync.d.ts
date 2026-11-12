import { Store, Unit } from "chain-store";

type Args<Params> = Params extends Array<unknown> ? Params : [Params];

export declare const sync: {
  (stores: { [key: string]: Store<any> }, scope?: string): () => void;
  <R extends unknown>(
    stores: { [key: string]: Store<any> },
    deps: () => Args<R>,
    scope?: string,
  ): () => void;
  <R extends unknown>(
    stores: { [key: string]: Store<any> },
    deps: () => R,
    scope?: string,
  ): () => void;
  <R extends unknown>(
    stores: { [key: string]: Store<any> },
    deps: () => Args<R>,
    match: (a: Args<R>, b: Args<R>) => boolean,
    scope?: string,
  ): () => void;
  <R extends unknown>(
    stores: { [key: string]: Store<any> },
    deps: () => R,
    match: (a: R, b: R) => boolean,
    scope?: string,
  ): () => void;
};
