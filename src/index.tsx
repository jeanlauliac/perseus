import {
  render,
  str,
  array,
  div,
  input,
  button,
  Element,
} from "perseus";

const App = () => {
  const name = str("world");
  const tasks = array<Element>();

  let nid = 1;

  const a = <div class="foo">foo bar {nid}</div>;

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
