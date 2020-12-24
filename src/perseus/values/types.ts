import { NodeDependency } from "../arrays";

export type RxZippedValueNodeContext = {
  sourceValues: unknown[];
  zipper: (_: unknown[]) => unknown;
  value: unknown;
  dependees: RxValueNode[];
};

export type RxZippedValueNode = {
  type: "zipped_value";
  index: number;
  context: RxZippedValueNodeContext;
};

export type RxInputValueNode = {
  type: "input_value";
  element: HTMLInputElement;
  value: string;
};

export type RxValueNode =
  | RxInputValueNode
  | RxZippedValueNode
  | { type: "style_value"; element: HTMLElement; styleName: string }
  | { type: "dynamic_node"; node: Node; deps: NodeDependency[] };

export interface RxValue<Value> {
  type: "rx_value";

  register<Node extends RxValueNode>(initNode: (_: Value) => Node): Node;
  unregister(node: RxValueNode): void;
}

export type MapToRxValue<T> = { [K in keyof T]: RxValue<T[K]> };
