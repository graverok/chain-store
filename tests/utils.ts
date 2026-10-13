export const delay = (n?: number) => {
  return new Promise<void>((resolve) => {
    if (typeof n !== "number") return resolve();
    setTimeout(resolve, n);
  });
};

export const mapper = (m: number) => (n: number) => {
  return new Promise<number>((resolve) => {
    setTimeout(() => resolve(n * m), 200);
  });
};

export const filter = (v: number) => (n: number) => {
  return new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(n !== v), 200);
  });
};
