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

  return { type: "html_element", tag, props };
};
