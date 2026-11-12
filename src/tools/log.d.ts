import { Store, Unit } from "chain-store";

export declare const log: {
  (stores: { [key: string]: Store<any> }, scope?: string): () => void;
  (
    units: { [unit: string]: Unit | Unit<any, any> },
    scope?: string,
  ): () => void;
  (
    stores: { [key: string]: Store<any> },
    units: { [unit: string]: Unit | Unit<any, any> },
    scope?: string,
  ): () => void;
};

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: unknown;
  }
}
