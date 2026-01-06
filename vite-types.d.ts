declare module "*.ts?worker" {
  const Worker: {
    new (options?: { type?: "classic" | "module" }): Worker;
  };
  export default Worker;
}

declare module "*.tsx?worker" {
  const Worker: {
    new (options?: { type?: "classic" | "module" }): Worker;
  };
  export default Worker;
}
