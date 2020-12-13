export type Element =
  | string
  | Str
  | Array<any>
  | {
      type: "html_element";
      tag: "div" | "span";
      children: Element[];
    }
  | { type: "input_element"; value: Str; onChange: (_: string) => void }
  | { type: "button_element"; onPress: () => void; children: Element[] };

type StrLink =
  | { type: "input_value"; element: HTMLInputElement }
  | { type: "text_node"; node: Text };
export type Str = { type: "string"; value: string; links: StrLink[] };
export type MutStr = Str & {
  set: (_: string) => void;
};

type ArrLink = { type: "dom_element_range"; last: ChildNode };
export type Array<Elem> = { type: "array"; value: Elem[]; links: ArrLink[] };
export type MutArray<Elem> = Array<Elem> & { push: (e: Elem) => void };

function exhaustive(_: never): void {
  throw new Error("invalid value");
}

export const div = (...children: Element[]): Element => {
  return { type: "html_element", tag: "div", children };
};

export const span = (...children: Element[]): Element => {
  return { type: "html_element", tag: "span", children };
};

export const input = ({
  value,
  onChange,
}: {
  value: Str;
  onChange: (_: string) => void;
}): Element => {
  return { type: "input_element", value, onChange };
};

export const button = (
  props: {
    onPress: () => void;
  },
  ...children: Element[]
): Element => {
  return { type: "button_element", onPress: props.onPress, children };
};

export const render = (parentElement: Node, element: Element) => {
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

    case "string": {
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
        element.onChange(el.value);
        if (element.value.value !== el.value) {
          el.value = element.value.value;
        }
      };
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
      for (const item of element.value) {
        if (
          typeof item == "object" &&
          (item as Array<unknown>).type === "array"
        ) {
          throw new Error("arrays cannot be nested");
        }
        render(parentElement, item as Element);
      }
      const { lastChild } = parentElement;
      element.links.push({ type: "dom_element_range", last: lastChild });
      return;
    }

    default:
      exhaustive(element);
  }
};

export const str = (initialValue: string): MutStr => {
  const ref: MutStr = {
    type: "string",
    value: initialValue,
    links: [],
    set: (newValue: string) => {
      ref.value = newValue;
      for (const link of ref.links) {
        switch (link.type) {
          case "input_value": {
            link.element.value = newValue;
            break;
          }

          case "text_node": {
            link.node.data = newValue;
            break;
          }

          default:
            exhaustive(link);
        }
      }
    },
  };
  return ref;
};

export const array = <Elem>(): MutArray<Elem> => {
  const ref: MutArray<Elem> = {
    type: "array",
    value: [],
    links: [],
    push: (e: Elem) => {
      ref.value.push(e);
      for (const link of ref.links) {
        switch (link.type) {
          case "dom_element_range": {
            const newChild = document.createDocumentFragment();
            render(newChild, (e as unknown) as Element);
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

          // default:
          //   exhaustive(link);
        }
      }
    },
  };
  return ref;
};
