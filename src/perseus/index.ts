export type Element =
  | string
  | Scalar<string>
  | Array<any>
  | {
      type: "html_element";
      tag: "div" | "span";
      children: Element[];
    }
  | {
      type: "input_element";
      value: Scalar<string>;
      onChange: (_: string) => void;
      onKeyPress: (_: KeyboardEvent) => void;
    }
  | { type: "button_element"; onPress: () => void; children: Element[] };

type ArrLink =
  | { type: "dom_element_range"; anchor: Node; last: ChildNode }
  | {
      type: "mapped_array";
      mappedRef: Array<unknown>;
      mapper: (e: unknown) => unknown;
    };

export type Array<Elem> = {
  type: "array";
  value: Elem[];
  links: ArrLink[];
  map<MappedElem>(mapper: (e: Elem) => MappedElem): Array<MappedElem>;
  indexOf(e: Elem): number;
};
export type MutArray<Elem> = Array<Elem> & {
  push: (e: Elem) => void;
  splice: (start: number, count: number) => Elem[];
};

function exhaustive(_: never): void {
  throw new Error("invalid value");
}

export const render = (parentElement: Node, element: Element) => {
  renderImpl(parentElement, element);
};

const renderImpl = (parentElement: Node, element: Element) => {
  if (typeof element === "string") {
    parentElement.appendChild(document.createTextNode(element));
    return;
  }

  switch (element.type) {
    case "html_element": {
      const el = document.createElement(element.tag);
      for (const child of element.children) {
        render(el, child);
      }
      parentElement.appendChild(el);
      return;
    }

    case "scalar": {
      const node = document.createTextNode(element.value);
      element.links.push({ type: "text_node", node });
      parentElement.appendChild(node);
      return;
    }

    case "input_element": {
      const el = document.createElement("input") as HTMLInputElement;
      el.value = element.value.value;
      element.value.links.push({ type: "input_value", element: el });
      el.oninput = () => {
        element.onChange != null && element.onChange(el.value);
        if (element.value.value !== el.value) {
          el.value = element.value.value;
        }
      };
      if (element.onKeyPress) {
        el.onkeypress = element.onKeyPress;
      }
      parentElement.appendChild(el);
      return;
    }

    case "button_element": {
      const el = document.createElement("button") as HTMLButtonElement;
      for (const child of element.children) {
        render(el, child);
      }
      el.onclick = () => {
        element.onPress();
      };
      parentElement.appendChild(el);
      return;
    }

    case "array": {
      const anchor = document.createComment("array anchor");
      parentElement.appendChild(anchor);

      for (const item of element.value) {
        if (
          typeof item == "object" &&
          (item as Array<unknown>).type === "array"
        ) {
          throw new Error("arrays cannot be nested");
        }
        renderImpl(parentElement, item as Element);
      }

      const last = parentElement.lastChild;
      element.links.push({
        type: "dom_element_range",
        anchor,
        last,
      });
      return;
    }

    default:
      exhaustive(element);
  }
};

type ScalarValue = string | number | boolean;
type ScalarLink =
  | { type: "input_value"; element: HTMLInputElement }
  | { type: "text_node"; node: Text }
  | {
      type: "mapped_value";
      mapper: (_: unknown) => ScalarValue;
      ref: Scalar<ScalarValue>;
    };
export type Scalar<Value extends ScalarValue> = {
  type: "scalar";
  value: Value;
  links: ScalarLink[];
  map: <MappedValue extends ScalarValue>(
    mapper: (_: Value) => MappedValue
  ) => Scalar<MappedValue>;
};
export type MutScalar<Value extends ScalarValue> = Scalar<Value> & {
  set: (_: Value) => void;
};

export const useScalar = <Value extends ScalarValue>(
  initialValue: Value
): MutScalar<Value> => {
  const set = <Value extends ScalarValue>(
    ref: MutScalar<Value>,
    newValue: Value
  ) => {
    ref.value = newValue;
    const queue: [unknown, ScalarLink][] = ref.links.map((link) => [
      newValue,
      link,
    ]);

    while (queue.length > 0) {
      const [newValue, link] = queue.shift();
      switch (link.type) {
        case "input_value": {
          assert(typeof newValue === "string");
          link.element.value = newValue;
          break;
        }

        case "text_node": {
          assert(typeof newValue === "string");
          link.node.data = newValue;
          break;
        }

        case "mapped_value": {
          const mappedValue = (link.ref.value = link.mapper(ref.value));
          for (const mappedLink of link.ref.links) {
            queue.push([mappedValue, mappedLink]);
          }
          break;
        }

        default:
          exhaustive(link);
      }
    }
  };

  const map = <Value extends ScalarValue, MappedValue extends ScalarValue>(
    ref: Scalar<Value>,
    mapper: (_: Value) => MappedValue
  ) => {
    const mappedRef: Scalar<MappedValue> = {
      type: "scalar",
      value: mapper(ref.value),
      links: [],
      map: (mapper) => map(mappedRef, mapper),
    };
    ref.links.push({ type: "mapped_value", mapper, ref: mappedRef });
    return mappedRef;
  };

  const ref: MutScalar<Value> = {
    type: "scalar",
    value: initialValue,
    links: [],
    set: (value) => set(ref, value),
    map: (mapper) => map(ref, mapper),
  };
  return ref;
};

const mapArray = <Elem, MappedElem>(
  ref: Array<Elem>,
  mapper: (e: Elem) => MappedElem
): Array<MappedElem> => {
  const mappedRef: Array<MappedElem> = {
    type: "array",
    value: ref.value.map((e) => mapper(e)),
    links: [] as ArrLink[],
    map: (mapper) => mapArray(mappedRef, mapper),
    indexOf: (e) => mappedRef.value.indexOf(e),
  };
  ref.links.push({ type: "mapped_array", mappedRef, mapper });
  return mappedRef;
};

export const useArray = <Elem>(): MutArray<Elem> => {
  const ref: MutArray<Elem> = {
    type: "array",
    value: [],
    links: [],
    push(e: Elem) {
      ref.value.push(e);

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
  };
  return ref;
};

function assert(cond: boolean): asserts cond {
  if (!cond) {
    throw new Error("failed assertion");
  }
}
