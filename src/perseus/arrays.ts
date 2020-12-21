import { Element, render } from "./rendering";
import { exhaustive } from "./utils";
import { RxMutValue, RxValue, useValue } from "./values";

export type RxMappedArrayNode = {
  type: "mapped_array";
  mapper: (e: unknown) => unknown;
  value: unknown[];
  dependees: RxArrayNode[];
};

export type RxDOMArrayNode = {
  type: "dom_element_range";
  anchor: Node;
  last: Node;
};

export type RxArrayNode = RxDOMArrayNode | RxMappedArrayNode;

export interface RxArray<Elem> {
  type: "array";
  readonly length: RxValue<number>;

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem>;
  register(node: RxArrayNode): Elem[];
}

// function initializeNode(value: unknown[], node: RxArrayNode) {
//   switch (node.type) {
//     case "dom_element_range": {
//       for (const elem of value) {
//         if (
//           typeof elem == "object" &&
//           (elem as RxArray<unknown>).type === "array"
//         ) {
//           throw new Error("arrays cannot be nested");
//         }
//         render(node.parentElement, elem as Element);
//       }
//       node.last = node.parentElement.lastChild;
//       break;
//     }

//     case "mapped_array": {
//       node.value = value.map(node.mapper);
//       break;
//     }

//     default:
//       exhaustive(node);
//   }
// }

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

  register(node: RxArrayNode): Elem[] {
    if (this.node != null) {
      this.node.dependees.push(node);
      return this.node.value as Elem[];
    }
    this.node = {
      type: "mapped_array",
      mapper: this.mapper,
      value: [],
      dependees: [node],
    };
    const sourceValue = this.source.register(this.node);
    return (this.node.value = sourceValue.map(this.mapper));
  }
}

export class RxMutArray<Elem> implements RxArray<Elem> {
  type: "array" = "array";
  private _value: Elem[] = [];
  private _length: RxMutValue<number> = new RxMutValue(0);
  private dependees: RxArrayNode[] = [];

  RxMutArray() {}

  get length() {
    return this._length;
  }

  get value(): ReadonlyArray<Elem> {
    return this._value;
  }

  map<MappedElem>(mapper: (_: Elem) => MappedElem): RxArray<MappedElem> {
    return new RxMappedArray(this, mapper);
  }

  register(node: RxArrayNode): Elem[] {
    this.dependees.push(node);
    return this._value;
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
    const rest = this._value.splice(start, deleteCount);
    this._length.set(this._value.length);

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
