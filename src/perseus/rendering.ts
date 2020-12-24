import { NodeDependency, RxArray, RxDOMArrayNode } from "./arrays";
import { assert, exhaustive } from "./utils";
import { RxInputValueNode, RxValue } from "./values/types";

export type Element =
  | null
  | undefined
  | string
  | RxValue<Element>
  | RxArray<any>
  | HtmlElement;

type HtmlElement = {
  type: "html_element";
  tag: string;
  props: {
    value?: RxValue<string>;
    children?: Element[];
    onChange?: (_: InputEvent) => void;
    onPress?: (_: UIEvent) => void;
    onKeyPress?: (_: KeyboardEvent) => void;
    style: { [key: string]: RxValue<string> | string };
    placeholder: string;
  };
};

export function render(
  parentElement: Node,
  element: Element
): NodeDependency[] {
  if (element == null) {
    return [];
  }

  if (typeof element === "string") {
    parentElement.appendChild(document.createTextNode(element));
    return [];
  }

  switch (element.type) {
    case "html_element":
      const [el, deps] = renderHtmlElement(element);
      parentElement.appendChild(el);
      return deps;

    case "rx_value": {
      const rxNode = element.register((value) => {
        let [node, deps] = renderRxValue(value);
        return { type: "dynamic_node", node, deps };
      });
      parentElement.appendChild(rxNode.node);
      return [{ type: "value", source: element, node: rxNode }];
    }

    case "array": {
      let deps: NodeDependency[] = [];

      const anchor = document.createComment("array anchor");
      parentElement.appendChild(anchor);

      const depsArray: NodeDependency[][] = [];

      element.register((value) => {
        for (const elem of value) {
          if (
            typeof elem == "object" &&
            (elem as RxArray<unknown>).type === "array"
          ) {
            throw new Error("arrays cannot be nested");
          }
          depsArray.push(render(parentElement, elem as Element));
        }

        deps.push({ type: "array", depsArray });
        return {
          type: "dom_element_range",
          anchor,
          last: parentElement.lastChild,
          depsArray,
        };
      });

      return deps;
    }

    default:
      exhaustive(element);
  }
}

export function renderHtmlElement(
  element: HtmlElement
): [Node, NodeDependency[]] {
  let deps: NodeDependency[] = [];

  const el = document.createElement(element.tag);
  const { props } = element;

  for (const child of props.children || []) {
    deps = deps.concat(render(el, child));
  }

  if (element.tag === "input") {
    const input = el as HTMLInputElement;
    let node: RxInputValueNode;

    if (props.value != null) {
      node = props.value.register((value) => {
        input.value = value;
        return { type: "input_value", element: input, value };
      });
      deps.push({ type: "value", source: props.value, node });
    }

    input.oninput = (ev: InputEvent) => {
      if (props.onChange != null) props.onChange(ev);
      if (node != null && node.value !== input.value) {
        input.value = node.value;
      }
    };

    if (props.onKeyPress != null) {
      input.onkeypress = props.onKeyPress;
    }
    if (props.placeholder != null) {
      input.placeholder = props.placeholder;
    }
  }

  if (props.onPress != null) el.onclick = props.onPress;

  for (const styleName of Object.keys(props.style || {})) {
    const styleValue = props.style[styleName];
    if (typeof styleValue === "string") {
      (el.style as any)[styleName] = styleValue;
      continue;
    }
    const node = styleValue.register((value) => {
      (el.style as any)[styleName] = value;
      return { type: "style_value", element: el, styleName };
    });
    deps.push({ type: "value", source: styleValue, node });
  }

  return [el, deps];
}

export function renderRxValue(value: Element): [Node, NodeDependency[]] {
  if (value == null) {
    return [document.createComment("empty spot"), []];
  }

  if (typeof value === "string" || typeof value === "number") {
    return [document.createTextNode(String(value)), []];
  }

  assert(typeof value === "object" && value.type === "html_element");
  return renderHtmlElement(value);
}
