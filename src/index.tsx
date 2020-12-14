import {
  render,
  useStr,
  useArray,
  Element,
  MutArray,
  Str,
} from "./perseus/index";

type Task = { id: number; name: string };

const AddTaskButton = (props: { tasks: MutArray<Task>; name: Str }) => {
  let nid = 1;

  const onPress = () => props.tasks.push({ id: nid++, name: props.name.value });
  return <button onPress={onPress}>Add task</button>;
};

const App = () => {
  const name = useStr("world");
  const tasks = useArray<Task>();

  return (
    <div>
      <div>hello, {name}</div>
      {tasks.map((task) => (
        <div>
          {task.id.toString()}. {task.name}&nbsp;
          <button onPress={() => tasks.splice(tasks.indexOf(task), 1)}>
            delete
          </button>
        </div>
      ))}
      <input value={name} onChange={name.set} />
      <AddTaskButton tasks={tasks} name={name} />
    </div>
  );
};

render(document.body, <App />);
