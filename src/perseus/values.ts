import { assert, exhaustive } from "./utils";

type RxZippedValueNodeContext = {
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
  | { type: "text_node"; node: Text };

export interface RxValue<Value> {
  type: "scalar";

  register<Node extends RxValueNode>(initNode: (_: Value) => Node): Node;
  unregister(node: RxValueNode): void;
}

export type MapToRxValue<T> = { [K in keyof T]: RxValue<T[K]> };

// This handles 'zipping' several other `RxValues` together into a single
// output value. Zipping is just the same as a 'map' operation, just
// with several inputs at a time.
export class RxZippedValue<
  InputTuple extends ReadonlyArray<unknown>,
  ZippedValue
> implements RxValue<ZippedValue> {
  type: "scalar" = "scalar";

  // The nodes in the update graph that we created
  // to control each input value.
  private _nodes?: RxZippedValueNode[] = undefined;

  // The context is basically a node of the graph
  // that takes all the value nodes as input.
  private _context?: RxZippedValueNodeContext = undefined;

  private _sources: ReadonlyArray<RxValue<unknown>>;
  private _zipper: (_: unknown) => unknown;

  constructor(
    sources: MapToRxValue<InputTuple>,
    zipper: (_: InputTuple) => ZippedValue
  ) {
    this._sources = sources;
    this._zipper = zipper;
  }

  register<Node extends RxValueNode>(initNode: (_: ZippedValue) => Node): Node {
    // If there's a context, we already registered a dependee before, we
    // are already in the update graph and the value is up-to-date.
    // We just append the new dependendee.
    if (this._context != null) {
      const newNode = initNode(this._context.value as ZippedValue);
      this._context.dependees.push(newNode);
      return newNode;
    }

    // Create a skeleton of the context. We need to construct the nodes,
    // but we don't have any values yet.
    let context: RxZippedValueNodeContext;
    this._context = context = {
      sourceValues: [],
      zipper: this._zipper,
      value: undefined,
      dependees: [],
    };

    // Register a node into each source, keeping in track the exact
    // index within the source array. These indices will be matched in the
    // `_nodes` and the `sourceValues` arrays, and they all have the same
    // length.
    this._nodes = this._sources.map((source, index) =>
      source.register((sourceValue) => {
        context.sourceValues.push(sourceValue);
        return { type: "zipped_value", index, context } as RxZippedValueNode;
      })
    );

    // Now that we registered all inputs, we have our array of source values.
    // We can call the user-defined zipper callback to compute the initial
    // 'zipped' value, which in turns allows us to initialize the dependee.
    context.value = this._zipper(context.sourceValues);
    const newNode = initNode(context.value as ZippedValue);
    context.dependees.push(newNode);

    return newNode;
  }

  unregister(node: RxValueNode): void {
    // That node has to be in our dependees.
    const index = this._context.dependees.indexOf(node);
    assert(index >= 0);

    // Get rid of it, if there are other dependees, then
    // nothing else happen, we need to keep updating the values.
    this._context.dependees.splice(index, 1);
    if (this._context.dependees.length > 0) return;

    // If we don't need the nodes anymore, we'll unregister
    // everything (might allow for our sources to unregister their
    // own sources, in turn). We make sure to empty the state so
    // that this value can become live again if `register` is called.
    this._sources.forEach((source, index) => {
      source.unregister(this._nodes[index]);
    });
    this._nodes = undefined;
    this._context = undefined;
  }
}

export class RxMutValue<Value> implements RxValue<Value> {
  type: "scalar" = "scalar";
  private dependees: RxValueNode[] = [];

  constructor(private _value: Value) {}

  get value() {
    return this._value;
  }

  register<Node extends RxValueNode>(initNode: (_: Value) => Node): Node {
    const newNode = initNode(this._value);
    this.dependees.push(newNode);
    return newNode;
  }

  unregister(node: RxValueNode): void {
    const index = this.dependees.indexOf(node);
    assert(index >= 0);
    this.dependees.splice(index, 1);
  }

  set(newValue: Value) {
    this._value = newValue;
    const queue = this.dependees.map(
      (node) => [newValue, node] as [unknown, RxValueNode]
    );

    while (queue.length > 0) {
      const [value, node] = queue.shift();
      switch (node.type) {
        case "input_value": {
          assert(typeof value === "string");
          node.element.value = node.value = value;
          break;
        }

        case "text_node": {
          // Super simple, just need to update the text shown.
          node.node.data = String(value);
          break;
        }

        case "zipped_value": {
          // For refreshing zipped values, we update in-place the array that contains
          // all previously calculated input values.
          node.context.sourceValues[node.index] = value;

          // Then we can call the zipper function again, update the cached value.
          const zippedValue = node.context.zipper(node.context.sourceValues);
          node.context.value = zippedValue;

          // Finally we proceed forward.
          for (const depNode of node.context.dependees) {
            queue.push([zippedValue, depNode]);
          }

          break;
        }

        case "style_value": {
          // Null/undefined means we want to remove the style.
          // Setting the corresponding field to empty string achieves that
          // per the DOM API
          if (value == null) {
            (node.element.style as any)[node.styleName] = "";
            break;
          }

          // Otherwise, we cast the value to a string. That allows
          // setting numbers directly for example.
          (node.element.style as any)[node.styleName] = String(value);

          break;
        }

        default:
          exhaustive(node);
      }
    }
  }
}

export function useValue<Value>(initialValue: Value): RxMutValue<Value> {
  return new RxMutValue(initialValue);
}
