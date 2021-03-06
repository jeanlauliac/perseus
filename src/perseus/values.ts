import { assert, exhaustive } from "./utils";

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
