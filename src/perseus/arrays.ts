import { Element, render } from "./rendering";
import { exhaustive } from "./utils";
import { RxMutValue, RxValue, RxValueNode, useValue } from "./values";

export type RxMappedArrayNode = {
  type: "mapped_array";
  mapper: (e: unknown) => unknown;
  value: unknown[];
  dependees: RxArrayNode[];
};

export type NodeDependency = { source: RxValue<unknown>; node: RxValueNode };

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
    const rest = this._value.splice(start, deleteCount);
    this._length.set(this._value.length);

    const queue: RxArrayNode[] = [...this.dependees];
    while (queue.length > 0) {
      const node = queue.shift();

      switch (node.type) {
        case "dom_element_range": {
          const removedDeps = node.depsArray.splice(start, deleteCount);
          for (const deps of removedDeps) {
            for (const dep of deps) {
              dep.source.unregister(dep.node);
            }
          }

          let removedNode = node.anchor.nextSibling;
          const parentNode = node.anchor.parentNode;

          for (let i = 0; i < start; ++i) {
            removedNode = removedNode.nextSibling;
          }
          for (let i = 0; i < deleteCount - 1; ++i) {
            const next = removedNode.nextSibling;
            parentNode.removeChild(removedNode);
            removedNode = next;
          }
          if (deleteCount > 0) {
            if (removedNode === node.last) {
              node.last = removedNode.previousSibling;
            }
            parentNode.removeChild(removedNode);
          }
          break;
        }

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

    return rest;
  }
}

export const useArray = <Elem>(initialValue: Elem[] = []): RxMutArray<Elem> => {
  return new RxMutArray(initialValue);
};
