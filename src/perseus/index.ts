type Element =
  | string
  | Value
  | {
      type: "html_element";
      tag: "div" | "span" | "input";
      children: Element[];
    }
  | { type: "input_element"; value: StrValue; onChange: (_: string) => void }
  | { type: "button_element"; onPress: () => void; children: Element[] };

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
  value: StrValue;
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

export const render = (parentElement: HTMLElement, element: Element) => {
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
      throw new Error("cannot render array as part of the tree");
    }

    default:
      exhaustive(element);
  }
};

type Link =
  | { type: "input_value"; element: HTMLInputElement }
  | { type: "text_node"; node: Text };
type StrValue = { type: "string"; value: string; links: Link[] };
type ArrValue = { type: "array"; value: []; links: Link[] };
type Value = StrValue | ArrValue;

type Str = { value: StrValue; set: (_: string) => void };
type Arr = { value: ArrValue; add: () => void };

export const useString = (initialValue: string): Str => {
  const value: StrValue = { type: "string", value: initialValue, links: [] };
  const set = (newValue: string) => {
    value.value = newValue;
    for (const link of value.links) {
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
  };
  return { value, set };
};

export const useArray = (): Arr => {
  return { value: { type: "array", value: [], links: [] }, add: () => {} };
};
