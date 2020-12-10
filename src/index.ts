import {
  render,
  str,
  array,
  div,
  input,
  button,
  Element,
} from "./perseus/index";

const App = () => {
  const name = str("world");
  const tasks = array<Element>();

  let nid = 1;

  return div(
    div("hello, ", name),
    tasks,
    input({
      value: name,
      onChange: name.set,
    }),
    button(
      {
        onPress: () => {
          tasks.push(div(nid + ". " + name.value));
          ++nid;
        },
      },
      "Add task"
    )
  );
};

render(document.body, App());
