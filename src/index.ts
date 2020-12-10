import { render, str, useArray, div, input, button } from "./perseus/index";

const App = () => {
  const name = str("world");
  const tasks = useArray();

  return div(
    div("hello, ", name),
    input({
      value: name,
      onChange: name.set,
    }),
    button(
      {
        onPress: () => {
          tasks.push(div(name.value));
        },
      },
      "Add task"
    ),
    tasks.value,
    div("END")
  );
};

render(document.body, App());
