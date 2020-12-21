import { Element, render } from "./rendering";
import { exhaustive } from "./utils";
import { RxMutValue, RxValue, useValue } from "./values";

type RxMappedArrayNode = {
  type: "mapped_array";
  mapper: (e: unknown) => unknown;
  value: unknown[];
  dependees: RxArrayNode[];
};

type RxArrayNode =
  | { type: "dom_element_range"; anchor: Node; last: ChildNode }
  | RxMappedArrayNode;

export interface RxArray<Elem> {
  type: "array";
  readonly currentValue: Elem[];
  readonly length: RxValue<number>;

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem>;
  register(node: RxArrayNode): void;
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

  get currentValue(): Elem[] {
    if (this.node != null) return this.node.value as Elem[];
    return this.source.currentValue.map(this.mapper);
  }

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem> {
    return new RxMappedArray(this, mapper);
  }

  register(node: RxArrayNode): void {
    if (this.node != null) {
      this.node.dependees.push(node);
    }
    this.node = {
      type: "mapped_array",
      mapper: this.mapper,
      value: this.currentValue,
      dependees: [node],
    };
    this.source.register(this.node);
  }
}

export class RxMutArray<Elem> implements RxArray<Elem> {
  type: "array" = "array";
  private value: Elem[] = [];
  private _length: RxMutValue<number> = new RxMutValue(0);
  private dependees: RxArrayNode[] = [];

  RxMutArray() {}

  get length() {
    return this._length;
  }

  get currentValue() {
    return this.value;
  }

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem> {
    return new RxMappedArray(this, mapper);
  }

  register(node: RxArrayNode) {
    this.dependees.push(node);
  }

  indexOf(e: Elem): number {
    return this.value.indexOf(e);
  }

  push(e: Elem): void {
    this.value.push(e);
    this._length.set(this.value.length);

    const queue: [RxArrayNode, unknown][] = [];
    for (const node of this.dependees) {
      queue.push([node, e]);
    }

    while (queue.length > 0) {
      const [node, elem] = queue.shift();

      switch (node.type) {
        case "dom_element_range": {
          const newChild = document.createDocumentFragment();
          render(newChild, (elem as unknown) as Element);
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
    const rest = this.value.splice(start, deleteCount);
    this._length.set(this.value.length);

    const queue: RxArrayNode[] = [...this.dependees];
    while (queue.length > 0) {
      const node = queue.shift();

      switch (node.type) {
        case "dom_element_range": {
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

export const useArray = <Elem>(): RxMutArray<Elem> => {
  return new RxMutArray();
};
