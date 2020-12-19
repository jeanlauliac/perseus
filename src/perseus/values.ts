import { assert, exhaustive } from "./utils";

type RxValueLink =
  | { type: "input_value"; element: HTMLInputElement }
  | { type: "style_value"; element: HTMLElement; styleName: string }
  | { type: "text_node"; node: Text }
  | {
      type: "mapped_value";
      mapper: (_: unknown) => unknown;
      ref: RxValue<unknown>;
    };

export type RxValue<Value> = {
  type: "scalar";
  value: Value;
  links: RxValueLink[];
  map: <MappedValue>(mapper: (_: Value) => MappedValue) => RxValue<MappedValue>;
};

export type RxMutValue<Value> = RxValue<Value> & {
  set: (_: Value) => void;
};

export function useValue<Value>(initialValue: Value): RxMutValue<Value> {
  const ref: RxMutValue<Value> = {
    type: "scalar",
    value: initialValue,
    links: [],
    set: (value) => set(ref, value),
    map: (mapper) => map(ref, mapper),
  };
  return ref;
}

function set<Value>(ref: RxMutValue<Value>, newValue: Value) {
  ref.value = newValue;
  const queue: [unknown, RxValueLink][] = ref.links.map((link) => [
    newValue,
    link,
  ]);

  while (queue.length > 0) {
    const [value, link] = queue.shift();
    switch (link.type) {
      case "input_value": {
        assert(typeof value === "string");
        link.element.value = value;
        break;
      }

      case "text_node": {
        assert(typeof value === "string");
        link.node.data = value;
        break;
      }

      case "mapped_value": {
        const mappedValue = (link.ref.value = link.mapper(ref.value));
        for (const mappedLink of link.ref.links) {
          queue.push([mappedValue, mappedLink]);
        }
        break;
      }

      case "style_value": {
        assert(typeof value === "string" || value == null);
        if (value == null) {
          (link.element.style as any)[link.styleName] = "";
          break;
        }
        (link.element.style as any)[link.styleName] = value;
        break;
      }

      default:
        exhaustive(link);
    }
  }
}

function map<Value, MappedValue>(
  ref: RxValue<Value>,
  mapper: (_: Value) => MappedValue
) {
  const mappedRef: RxValue<MappedValue> = {
    type: "scalar",
    value: mapper(ref.value),
    links: [],
    map: (mapper) => map(mappedRef, mapper),
  };
  ref.links.push({ type: "mapped_value", mapper, ref: mappedRef });
  return mappedRef;
}
