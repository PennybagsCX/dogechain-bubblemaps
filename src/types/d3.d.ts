/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "d3" {
  // Minimal surface to satisfy app typings; all are loose any-based.
  export type ZoomTransform = any;
  export type ZoomBehavior<GElement = any, Datum = any> = any;
  export type Simulation<NodeDatum = any, LinkDatum = any> = any;

  export function select(selector: any): any;

  export function zoom<GElement = any, Datum = any>(): ZoomBehavior<GElement, Datum>;
  export const zoomIdentity: ZoomTransform;
  export function zoomTransform(node: any): ZoomTransform;

  export function forceSimulation<NodeDatum = any>(nodes?: NodeDatum[]): Simulation<NodeDatum, any>;
  export function forceLink<NodeDatum = any, Links = any>(links?: Links[]): any;
  export function forceManyBody<NodeDatum = any>(): any;
  export function forceCollide<NodeDatum = any>(): any;
  export function forceX(x?: number): any;
  export function forceY(y?: number): any;

  export function drag<GElement = any, Datum = any>(): any;

  export function scaleSqrt(): any;
  export function pack(): any;
  export function hierarchy(data: any): any;
  export function easeCubicOut(t: number): number;

  export function max<T>(arr: Iterable<T>, accessor?: (d: T) => number): number | undefined;
  export function min<T>(arr: Iterable<T>, accessor?: (d: T) => number): number | undefined;
  export function color(
    value: string
  ): { brighter: (k?: number) => { formatHex: () => string } } | null;
}
