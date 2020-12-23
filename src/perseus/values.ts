import { assert, exhaustive } from "./utils";

export type RxMappedValueNode = {
  type: "mapped_value";
  mapper: (_: unknown) => unknown;
  value: unknown;
  dependees: RxValueNode[];
};

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
  | { type: "style_value"; element: HTMLElement; styleName: string }
  | { type: "text_node"; node: Text }
  | RxMappedValueNode
  | RxZippedValueNode;

export interface RxValue<Value> {
  type: "scalar";

  register<Node extends RxValueNode>(initNode: (_: Value) => Node): Node;
  unregister(node: RxValueNode): void;
}

export class RxMappedValue<SourceValue, Value> implements RxValue<Value> {
  type: "scalar" = "scalar";
  private node?: RxMappedValueNode = undefined;

  constructor(
    private source: RxValue<SourceValue>,
    private mapper: (_: SourceValue) => Value
  ) {}

  register<Node extends RxValueNode>(initNode: (_: Value) => Node): Node {
    let newNode;

    if (this.node != null) {
      newNode = initNode(this.node.value as Value);
      this.node.dependees.push(newNode);
      return newNode;
    }

    this.node = this.source.register((sourceValue) => {
      const value = this.mapper(sourceValue);
      newNode = initNode(value);

      return {
        type: "mapped_value",
        mapper: this.mapper,
        value,
        dependees: [newNode],
      };
    });

    return newNode;
  }

  unregister(node: RxValueNode): void {
    const index = this.node.dependees.indexOf(node);
    assert(index >= 0);
    this.node.dependees.splice(index, 1);
    if (this.node.dependees.length > 0) return;

    this.source.unregister(this.node);
    this.node = undefined;
  }
}

export type MapToRxValue<T> = { [K in keyof T]: RxValue<T[K]> };

export class RxZippedValue<
  InputTuple extends ReadonlyArray<unknown>,
  ZippedValue
> implements RxValue<ZippedValue> {
  type: "scalar" = "scalar";
  private _nodes: RxZippedValueNode[] = [];
  private _context?: RxZippedValueNodeContext;
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
    let newNode;

    if (this._context != null) {
      newNode = initNode(this._context.value as ZippedValue);
      this._context.dependees.push(newNode);
      return newNode;
    }

    let context: RxZippedValueNodeContext;
    this._context = context = {
      sourceValues: [],
      zipper: this._zipper,
      value: undefined,
      dependees: [],
    };

    this._nodes = this._sources.map((source, index) =>
      source.register((sourceValue) => {
        context.sourceValues.push(sourceValue);
        return { type: "zipped_value", index, context } as RxZippedValueNode;
      })
    );

    context.value = this._zipper(context.sourceValues);
    newNode = initNode(context.value as ZippedValue);
    context.dependees.push(newNode);

    return newNode;
  }

  unregister(node: RxValueNode): void {
    // const index = this.node.dependees.indexOf(node);
    // assert(index >= 0);
    // this.node.dependees.splice(index, 1);
    // if (this.node.dependees.length > 0) return;
    // this.source.unregister(this.node);
    // this.node = undefined;
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
          node.node.data = String(value);
          break;
        }

        case "mapped_value": {
          const mappedValue = (node.value = node.mapper(value));
          for (const depNode of node.dependees) {
            queue.push([mappedValue, depNode]);
          }
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
          assert(typeof value === "string" || value == null);
          if (value == null) {
            (node.element.style as any)[node.styleName] = "";
            break;
          }
          (node.element.style as any)[node.styleName] = value;
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
