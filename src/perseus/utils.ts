export function assert(cond: boolean): asserts cond {
  if (!cond) {
    throw new Error("failed assertion");
  }
}

export function exhaustive(_: never): void {
  throw new Error("invalid value");
}
