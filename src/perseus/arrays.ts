import { Element, render } from "./rendering";
import { exhaustive } from "./utils";
import { RxMutValue } from "./values/RxMutValue";
import { RxValue, RxValueNode } from "./values/types";

export type RxMappedArrayNode = {
  type: "mapped_array";
  mapper: (e: unknown) => unknown;
  value: unknown[];
  dependees: RxArrayNode[];
};

export type NodeDependency =
  | {
      type: "value";
      source: RxValue<unknown>;
      node: RxValueNode;
    }
  | {
      type: "array";
      depsArray: NodeDependency[][];
    };

export type RxDOMArrayNode = {
  type: "dom_element_range";
  anchor: Node;
  last: Node;
  depsArray: NodeDependency[][];
};

export type RxArrayNode = RxDOMArrayNode | RxMappedArrayNode;

export interface RxArray<Elem> {
  type: "array";
  readonly length: RxValue<number>;

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem>;
  register(initNode: (_: Elem[]) => RxArrayNode): void;
}

class RxMappedArray<SourceElem, Elem> implements RxArray<Elem> {
  type: "array" = "array";
  private node?: RxMappedArrayNode;

  constructor(
    private source: RxArray<SourceElem>,
    private mapper: (_: SourceElem) => Elem
  ) {}

  get length(): RxValue<number> {
    return this.source.length;
  }

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem> {
    return new RxMappedArray(this, mapper);
  }

  register(initNode: (_: Elem[]) => RxArrayNode): void {
    if (this.node != null) {
      this.node.dependees.push(initNode(this.node.value as Elem[]));
      return;
    }
    this.source.register((sourceValue) => {
      const value = sourceValue.map(this.mapper);
      return {
        type: "mapped_array",
        mapper: this.mapper,
        value,
        dependees: [initNode(value)],
      };
    });
  }
}

export class RxMutArray<Elem> implements RxArray<Elem> {
  type: "array" = "array";
  private _length: RxMutValue<number> = new RxMutValue(0);
  private dependees: RxArrayNode[] = [];

  constructor(private _value: Elem[]) {}

  get length() {
    return this._length;
  }

  get value(): ReadonlyArray<Elem> {
    return this._value;
  }

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem> {
    return new RxMappedArray(this, mapper);
  }

  register(initNode: (_: Elem[]) => RxArrayNode): void {
    this.dependees.push(initNode(this._value));
  }

  indexOf(e: Elem): number {
    return this._value.indexOf(e);
  }

  push(e: Elem): void {
    this._value.push(e);
    this._length.set(this._value.length);

    const queue: [RxArrayNode, unknown][] = [];
    for (const node of this.dependees) {
      queue.push([node, e]);
    }

    while (queue.length > 0) {
      const [node, elem] = queue.shift();

      switch (node.type) {
        case "dom_element_range": {
          const newChild = document.createDocumentFragment();
          node.depsArray.push(render(newChild, (elem as unknown) as Element));
          const beforeNode = node.last.nextSibling;
          const parentNode = node.last.parentNode;
          if (beforeNode != null) {
            parentNode.insertBefore(newChild, beforeNode);
            node.last = beforeNode.previousSibling;
          } else {
            parentNode.appendChild(newChild);
            node.last = parentNode.lastChild;
          }
          break;
        }

        case "mapped_array": {
          const mappedElem = node.mapper(e);
          node.value.push(mappedElem);
          for (const mappedLink of node.dependees) {
            queue.push([mappedLink, mappedElem]);
          }
          break;
        }

        default:
          exhaustive(node);
      }
    }
  }

  splice(start: number, deleteCount: number): Elem[] {
    // Make sure `deleteCount` doesn't exceed the array, as we don't
    // want to remove DOM nodes that aren't ours, notably.
    deleteCount = Math.min(this._value.length - start, deleteCount);

    // First off we splice the range from the base value.
    const rest = this._value.splice(start, deleteCount);

    // Queue up all the dependees we have to update.
    const queue: RxArrayNode[] = [...this.dependees];

    while (queue.length > 0) {
      const node = queue.shift();

      switch (node.type) {
        // We need to remove DOM nodes corresponding to the array elements.
        case "dom_element_range": {
          // Unregister anything that's used within these DOM nodes
          // because, since we remove them from the document, we don't
          // want them to update anymore. If we weren't removing these,
          // they would be garbage collected, as they would keep being
          // tracked as dependees.
          const removedDeps = node.depsArray.splice(start, deleteCount);
          this._releaseDeps(removedDeps);

          let removedNode = node.anchor.nextSibling;
          const parentNode = node.anchor.parentNode;

          // Browse all the way through the siblings to reach the first
          // deleted node.
          for (let i = 0; i < start; ++i) {
            removedNode = removedNode.nextSibling;
          }

          // Then remove them from the parent, moving to each sibling in
          // turn. We know we won't go too far because we adjusted `deleteCount`
          // to be the exact number of deleted element at the beginning of
          // this function.
          for (let i = 0; i < deleteCount - 1; ++i) {
            const next = removedNode.nextSibling;
            parentNode.removeChild(removedNode);
            removedNode = next;
          }

          if (deleteCount === 0) break;

          // We handle the last node to deleted specially to make sure
          // we update the `last` pointer, if the previous last node was
          // deleted.
          if (removedNode === node.last) {
            node.last = removedNode.previousSibling;
          }
          parentNode.removeChild(removedNode);

          break;
        }

        // When an array is mapped it has the same number of elements,
        // with matching indices. So we just splice at the same place,
        // and queue the next nodes that depend on the mapped values.
        case "mapped_array": {
          node.value.splice(start, deleteCount);
          for (const mappedNode of node.dependees) {
            queue.push(mappedNode);
          }
          break;
        }

        default:
          exhaustive(node);
      }
    }

    // Update the length last thing. This might trigger other updates,
    // we want to make that doesn't interfere with the process above.
    this._length.set(this._value.length);

    return rest;
  }

  private _releaseDeps(depsArray: NodeDependency[][]) {
    for (const deps of depsArray) {
      for (const dep of deps) {
        if (dep.type === "value") {
          dep.source.unregister(dep.node);
          continue;
        }
        this._releaseDeps(dep.depsArray);
      }
    }
  }
}

export const useArray = <Elem>(initialValue: Elem[] = []): RxMutArray<Elem> => {
  return new RxMutArray(initialValue);
};
