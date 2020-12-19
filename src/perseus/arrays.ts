import { Element, render } from "./rendering";
import { exhaustive } from "./utils";
import { RxValue, useValue } from "./values";

type ArrLink =
  | { type: "dom_element_range"; anchor: Node; last: ChildNode }
  | {
      type: "mapped_array";
      mappedRef: RxArray<unknown>;
      mapper: (e: unknown) => unknown;
    };

export type RxArray<Elem> = {
  type: "array";
  value: Elem[];
  links: ArrLink[];
  map<MappedElem>(mapper: (e: Elem) => MappedElem): RxArray<MappedElem>;
  indexOf(e: Elem): number;
  readonly length: RxValue<number>;
};

export type RxMutArray<Elem> = RxArray<Elem> & {
  push: (e: Elem) => void;
  splice: (start: number, count: number) => Elem[];
};

const mapArray = <Elem, MappedElem>(
  ref: RxArray<Elem>,
  mapper: (e: Elem) => MappedElem
): RxArray<MappedElem> => {
  const mappedRef: RxArray<MappedElem> = {
    type: "array",
    value: ref.value.map((e) => mapper(e)),
    links: [] as ArrLink[],
    map: (mapper) => mapArray(mappedRef, mapper),
    indexOf: (e) => mappedRef.value.indexOf(e),
    length: ref.length,
  };
  ref.links.push({ type: "mapped_array", mappedRef, mapper });
  return mappedRef;
};

export const useArray = <Elem>(): RxMutArray<Elem> => {
  const length = useValue<number>(0);
  const ref: RxMutArray<Elem> = {
    type: "array",
    value: [],
    links: [],
    push(e: Elem) {
      ref.value.push(e);
      length.set(ref.value.length);

      const queue: [ArrLink, unknown][] = [];
      for (const link of ref.links) {
        queue.push([link, e]);
      }

      while (queue.length > 0) {
        const [link, elem] = queue.shift();

        switch (link.type) {
          case "dom_element_range": {
            const newChild = document.createDocumentFragment();
            render(newChild, (elem as unknown) as Element);
            const beforeNode = link.last.nextSibling;
            const parentNode = link.last.parentNode;
            if (beforeNode != null) {
              parentNode.insertBefore(newChild, beforeNode);
              link.last = beforeNode.previousSibling;
            } else {
              parentNode.appendChild(newChild);
              link.last = parentNode.lastChild;
            }
            break;
          }

          case "mapped_array": {
            const mappedElem = link.mapper(e);
            link.mappedRef.value.push(mappedElem);
            for (const mappedLink of link.mappedRef.links) {
              queue.push([mappedLink, mappedElem]);
            }
            break;
          }

          default:
            exhaustive(link);
        }
      }
    },

    splice(start, deleteCount) {
      const rest = ref.value.splice(start, deleteCount);
      length.set(ref.value.length);

      const queue: ArrLink[] = [];
      for (const link of ref.links) {
        queue.push(link);
      }

      while (queue.length > 0) {
        const link = queue.shift();

        switch (link.type) {
          case "dom_element_range": {
            let removedNode = link.anchor.nextSibling;
            const parentNode = link.anchor.parentNode;

            for (let i = 0; i < start; ++i) {
              removedNode = removedNode.nextSibling;
            }
            for (let i = 0; i < deleteCount - 1; ++i) {
              const next = removedNode.nextSibling;
              parentNode.removeChild(removedNode);
              removedNode = next;
            }
            if (deleteCount > 0) {
              if (removedNode === link.last) {
                link.last = removedNode.previousSibling;
              }
              parentNode.removeChild(removedNode);
            }
            break;
          }

          case "mapped_array": {
            link.mappedRef.value.splice(start, deleteCount);
            for (const mappedLink of link.mappedRef.links) {
              queue.push(mappedLink);
            }
            break;
          }

          default:
            exhaustive(link);
        }
      }

      return rest;
    },

    map: (mapper) => mapArray(ref, mapper),
    indexOf: (e) => ref.value.indexOf(e),
    length,
  };
  return ref;
};
