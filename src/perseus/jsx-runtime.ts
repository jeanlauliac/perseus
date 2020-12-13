import { Element } from "./index";

const NO_CHILDREN: Element[] = [];

export const jsx = (
  tag: string | Function,
  props: { [key: string]: any; children: Element | undefined },
  key: unknown
): Element => {
  return jsxs(
    tag,
    {
      ...props,
      children: props.children != null ? [props.children] : NO_CHILDREN,
    },
    key
  );
};

export const jsxs = (
  tag: string | Function,
  props: { [key: string]: any; children: Element[] },
  key: unknown
): Element => {
  if (typeof tag === "function") {
    return tag(props, key);
  }

  switch (tag) {
    case "div":
    case "span":
      return { type: "html_element", tag, children: props.children };

    case "input":
      return {
        type: "input_element",
        value: props.value,
        onChange: props.onChange,
      };

    case "button":
      return {
        type: "button_element",
        onPress: props.onPress,
        children: props.children,
      };

    default:
      throw new Error("unknown tag");
  }
};
