import { releaseDeps } from "../arrays";
import { Element, renderRxValue } from "../rendering";
import { assert, exhaustive } from "../utils";
import { RxValue, RxValueNode } from "./types";

// This is the starting point for any sequence of transformations,
// and the only `RxValue` which value can be directly set.
export class RxMutValue<Value> implements RxValue<Value> {
  type: "rx_value" = "rx_value";

  // All the nodes that need to be updated when the value changes.
  private dependees: RxValueNode[] = [];

  constructor(private _value: Value) {}

  // Value can be read directly, but can only be set with `set`.
  // It makes it more explicit than having a mutator.
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
    // We keep track of the value, so it can be read later.
    this._value = newValue;

    // We now need to update all the transformations that depend
    // on this value.
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

        case "dynamic_node": {
          // If value is null is node is already a comment, we're done.
          if (value == null && node.node.nodeType === document.COMMENT_NODE)
            break;

          // If value was and is still a string, we just update the text node.
          if (
            (typeof value === "string" || typeof value === "number") &&
            node.node.nodeType === document.TEXT_NODE
          ) {
            (node.node as Text).data = String(value);
            break;
          }

          // Otherwise we need to recreate the node. We don't bother with diffing,
          // if the node was the same, user should use RxValues as attribute instead.
          //
          // First off we make sure anything used *inside* the node is released,
          // we don't want to update that old node anymore.
          releaseDeps(node.deps);

          // Re-render a fresh new DOM node, replace it.
          const [newNode, newDeps] = renderRxValue(value as Element);
          (node.node as ChildNode).replaceWith(newNode);

          // Update the tracked data.
          node.node = newNode;
          node.deps = newDeps;

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
