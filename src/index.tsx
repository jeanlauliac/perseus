import {
  render,
  useStr,
  useArray,
  Element,
  MutArray,
  Str,
} from "./perseus/index";

const AddTaskButton = (props: { tasks: MutArray<Element>; name: Str }) => {
  let nid = 1;

  const onPress = () => props.tasks.push(nid++ + ". " + props.name.value);
  return <button onPress={onPress}>Add task</button>;
};

const App = () => {
  const name = useStr("world");
  const tasks = useArray<Element>();

  return (
    <div>
      <div>hello, {name}</div>
      {tasks.map((task) => (
        <div>
          {task}&nbsp;
          <button onPress={() => name.set("not impl")}>delete</button>
        </div>
      ))}
      <input value={name} onChange={name.set} />
      <AddTaskButton tasks={tasks} name={name} />
    </div>
  );
};

render(document.body, <App />);
