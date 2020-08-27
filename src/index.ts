import {
  render,
  useString,
  useArray,
  div,
  input,
  button,
} from "./perseus/index";

const App = () => {
  const text = useString("world");
  const tasks = useArray();

  return div(
    div("hello, ", text.value),
    input({
      value: text.value,
      onChange: text.set,
    }),
    button(
      {
        onPress: () => {
          tasks.add();
        },
      },
      "Add task"
    )
  );
};

render(document.body, App());
