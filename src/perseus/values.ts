import { assert, exhaustive } from "./utils";

type RxMappedValueNode = {
  type: "mapped_value";
  mapper: (_: unknown) => unknown;
  value: unknown;
  dependees: RxValueNode[];
};

type RxValueNode =
  | { type: "input_value"; element: HTMLInputElement }
  | { type: "style_value"; element: HTMLElement; styleName: string }
  | { type: "text_node"; node: Text }
  | RxMappedValueNode;

export interface RxValue<Value> {
  type: "scalar";
  readonly currentValue: Value;
  map<MappedValue>(mapper: (_: Value) => MappedValue): RxValue<MappedValue>;
  register(node: RxValueNode): void;
}

export class RxMappedValue<SourceValue, Value> implements RxValue<Value> {
  type: "scalar" = "scalar";
  private node?: RxMappedValueNode = undefined;

  constructor(
    private source: RxValue<SourceValue>,
    private mapper: (_: SourceValue) => Value
  ) {}

  register(node: RxValueNode) {
    if (this.node != null) {
      this.node.dependees.push(node);
    }
    this.node = {
      type: "mapped_value",
      mapper: this.mapper,
      value: this.currentValue,
      dependees: [node],
    };
    this.source.register(this.node);
  }

  map<MappedValue>(mapper: (_: Value) => MappedValue): RxValue<MappedValue> {
    return new RxMappedValue(this, mapper);
  }

  get currentValue(): Value {
    if (this.node != null) return this.node.value as Value;
    return this.mapper(this.source.currentValue);
  }
}

export class RxMutValue<Value> implements RxValue<Value> {
  type: "scalar" = "scalar";
  private dependees: RxValueNode[] = [];

  constructor(private value: Value) {}

  register(node: RxValueNode) {
    this.dependees.push(node);
  }

  set(newValue: Value) {
    this.value = newValue;
    const queue = this.dependees.map(
      (node) => [newValue, node] as [unknown, RxValueNode]
    );

    while (queue.length > 0) {
      const [value, node] = queue.shift();
      switch (node.type) {
        case "input_value": {
          assert(typeof value === "string");
          node.element.value = value;
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

  get currentValue(): Value {
    return this.value;
  }
}

export function useValue<Value>(initialValue: Value): RxMutValue<Value> {
  return new RxMutValue(initialValue);
}
