import {
  render,
  useScalar,
  useArray,
  MutArray,
  Scalar,
  MutScalar,
} from "./perseus/index";

type Task = { id: number; name: string; isDone: MutScalar<boolean> };

const TaskRow = ({ task, onDelete }: { task: Task; onDelete: () => void }) => {
  return (
    <div>
      {task.id.toString()}. {task.name}&nbsp;
      <button onPress={() => onDelete()}>delete</button>
      <button onPress={() => task.isDone.set(!task.isDone.value)}>
        {task.isDone.map((value) => (value ? "done" : "NOT done"))}
      </button>
    </div>
  );
};

const App = () => {
  const name = useScalar<string>("world");
  const tasks = useArray<Task>();

  let nid = 1;

  const onPress = () => {
    if (name.value === "") return;
    tasks.push({
      id: nid++,
      name: name.value,
      isDone: useScalar(false),
    });
    name.set("");
  };

  return (
    <div>
      <div>hello, {name}</div>
      {tasks.map((task) => (
        <TaskRow
          task={task}
          onDelete={() => tasks.splice(tasks.indexOf(task), 1)}
        />
      ))}
      <input
        value={name}
        onChange={name.set}
        onKeyPress={(e: KeyboardEvent) => {
          if (e.key === "Enter") onPress();
        }}
      />
      <button onPress={onPress}>Add task</button>
    </div>
  );
};

render(document.body, <App />);
