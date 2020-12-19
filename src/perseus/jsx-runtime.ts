import { Element } from "./index";

const NO_CHILDREN: Element[] = [];

export const jsx = (
  tag: string | Function,
  props: any,
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
  props: any,
  key: unknown
): Element => {
  if (typeof tag === "function") {
    return tag(props, key);
  }

  switch (tag) {
    case "div":
    case "span":
    case "input":
    case "button":
      return { type: "html_element", tag, props };

    // case "input":
    //   return {
    //     type: "input_element",
    //     value: props.value,
    //     onChange: props.onChange,
    //     onKeyPress: props.onKeyPress,
    //   };

    // case "button":
    //   return {
    //     type: "button_element",
    //     onPress: props.onPress,
    //     children: props.children,
    //   };

    default:
      throw new Error("unknown tag");
  }
};
