import { assert, exhaustive } from "./utils";

export type RxMappedValueNode = {
  type: "mapped_value";
  mapper: (_: unknown) => unknown;
  value: unknown;
  dependees: RxValueNode[];
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
  | RxMappedValueNode;

export interface RxValue<Value> {
  type: "scalar";

  map<MappedValue>(mapper: (_: Value) => MappedValue): RxValue<MappedValue>;
  register(initNode: (_: Value) => RxValueNode): void;
}

export class RxMappedValue<SourceValue, Value> implements RxValue<Value> {
  type: "scalar" = "scalar";
  private node?: RxMappedValueNode = undefined;

  constructor(
    private source: RxValue<SourceValue>,
    private mapper: (_: SourceValue) => Value
  ) {}

  register(initNode: (_: Value) => RxValueNode): void {
    if (this.node != null) {
      this.node.dependees.push(initNode(this.node.value as Value));
      return;
    }
    this.source.register((sourceValue) => {
      const value = this.mapper(sourceValue);
      return (this.node = {
        type: "mapped_value",
        mapper: this.mapper,
        value,
        dependees: [initNode(value)],
      });
    });
  }

  map<MappedValue>(mapper: (_: Value) => MappedValue): RxValue<MappedValue> {
    return new RxMappedValue(this, mapper);
  }
}

export class RxMutValue<Value> implements RxValue<Value> {
  type: "scalar" = "scalar";
  private dependees: RxValueNode[] = [];

  constructor(private _value: Value) {}

  get value() {
    return this._value;
  }

  register(initNode: (_: Value) => RxValueNode): void {
    this.dependees.push(initNode(this._value));
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
          assert(typeof value === "string");
          node.node.data = value;
          break;
        }

        case "mapped_value": {
          const mappedValue = (node.value = node.mapper(value));
          for (const depNode of node.dependees) {
            queue.push([mappedValue, depNode]);
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

  map<MappedValue>(mapper: (_: Value) => MappedValue): RxValue<MappedValue> {
    return new RxMappedValue(this, mapper);
  }
}

export function useValue<Value>(initialValue: Value): RxMutValue<Value> {
  return new RxMutValue(initialValue);
}
