import { render, str, array, div, Element } from "./perseus/index";

const App = () => {
  const name = str("world");
  const tasks = array<Element>();

  let nid = 1;

  return (
    <div>
      <div>hello, {name}</div>
      {tasks}
      <input value={name} onChange={name.set} />
      <button onPress={() => tasks.push(div(nid++ + ". " + name.value))}>
        Add task
      </button>
    </div>
  );
};

render(document.body, App());
