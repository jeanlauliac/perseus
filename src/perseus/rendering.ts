import { RxArray, RxDOMArrayNode } from "./arrays";
import { exhaustive } from "./utils";
import { RxInputValueNode, RxValue } from "./values";

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
        placeholder: string;
      };
    };

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
        let node: RxInputValueNode;

        if (props.value != null) {
          props.value.register((value) => {
            input.value = value;
            return (node = { type: "input_value", element: input, value });
          });
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
        styleValue.register((value) => {
          (el.style as any)[styleName] = value;
          return { type: "style_value", element: el, styleName };
        });
      }

      parentElement.appendChild(el);
      return;
    }

    case "scalar": {
      let node: Text;
      element.register((value) => {
        node = document.createTextNode(value);
        return { type: "text_node", node };
      });
      parentElement.appendChild(node);
      return;
    }

    case "array": {
      const anchor = document.createComment("array anchor");
      parentElement.appendChild(anchor);
      element.register((value) => {
        for (const elem of value) {
          if (
            typeof elem == "object" &&
            (elem as RxArray<unknown>).type === "array"
          ) {
            throw new Error("arrays cannot be nested");
          }
          render(parentElement, elem as Element);
        }
        return {
          type: "dom_element_range",
          anchor,
          last: parentElement.lastChild,
        };
      });

      return;
    }

    default:
      exhaustive(element);
  }
};
