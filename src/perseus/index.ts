export type Element =
  | string
  | RxValue<string>
  | RxArray<any>
  | {
      type: "html_element";
      tag: string;
      props: {
        value?: RxValue<string>;
        children?: Element[];
        onChange?: (_: InputEvent) => void;
        onPress?: (_: UIEvent) => void;
        onKeyPress?: (_: KeyboardEvent) => void;
        style: { [key: string]: RxValue<string> | string };
      };
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
      const { props } = element;

      for (const child of props.children || []) {
        render(el, child);
      }

      if (element.tag === "input") {
        const input = el as HTMLInputElement;
        if (props.value != null) {
          input.value = props.value.value;
          props.value.links.push({ type: "input_value", element: input });
        }
        input.oninput = (ev: InputEvent) => {
          if (props.onChange != null) props.onChange(ev);
          if (props.value.value !== input.value) {
            input.value = props.value.value;
          }
        };
        if (props.onKeyPress != null) {
          input.onkeypress = props.onKeyPress;
        }
      }

      if (props.onPress != null) el.onclick = props.onPress;

      for (const styleName of Object.keys(props.style || {})) {
        const value = props.style[styleName];
        if (typeof value === "string") {
          (el.style as any)[styleName] = value;
          continue;
        }
        (el.style as any)[styleName] = value.value;
        value.links.push({ type: "style_value", element: el, styleName });
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

    case "array": {
      const anchor = document.createComment("array anchor");
      parentElement.appendChild(anchor);

      for (const item of element.value) {
        if (
          typeof item == "object" &&
          (item as RxArray<unknown>).type === "array"
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

export const useScalar = <Value>(initialValue: Value): RxMutValue<Value> => {
  const set = <Value>(ref: RxMutValue<Value>, newValue: Value) => {
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
  };

  const map = <Value, MappedValue>(
    ref: RxValue<Value>,
    mapper: (_: Value) => MappedValue
  ) => {
    const mappedRef: RxValue<MappedValue> = {
      type: "scalar",
      value: mapper(ref.value),
      links: [],
      map: (mapper) => map(mappedRef, mapper),
    };
    ref.links.push({ type: "mapped_value", mapper, ref: mappedRef });
    return mappedRef;
  };

  const ref: RxMutValue<Value> = {
    type: "scalar",
    value: initialValue,
    links: [],
    set: (value) => set(ref, value),
    map: (mapper) => map(ref, mapper),
  };
  return ref;
};

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
  const length = useScalar<number>(0);
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

function assert(cond: boolean): asserts cond {
  if (!cond) {
    throw new Error("failed assertion");
  }
}
