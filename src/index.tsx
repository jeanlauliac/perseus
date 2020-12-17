import { render, useScalar, useArray, MutScalar } from "./perseus/index";

type Task = { id: number; name: string; isDone: MutScalar<boolean> };

const TaskRow = ({ task, onDelete }: { task: Task; onDelete: () => void }) => {
  const textDecoration = task.isDone.map((value) =>
    value ? "strikethrough" : undefined
  );
  return (
    <div>
      <span style={{ textDecoration }}>{task.name}</span>
      &nbsp;
      <button onPress={onDelete}>delete</button>
      <button onPress={() => task.isDone.set(!task.isDone.value)}>
        {task.isDone.map((value) => (value ? "done 🎉" : "NOT done"))}
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
      <input
        value={name}
        onChange={name.set}
        onKeyPress={(e: KeyboardEvent) => {
          if (e.key === "Enter") onPress();
        }}
      />
      <button onPress={onPress}>Add task</button>
      {tasks.map((task) => (
        <TaskRow
          task={task}
          onDelete={() => tasks.splice(tasks.indexOf(task), 1)}
        />
      ))}
      <div>{tasks.length.map((l) => l.toString())} items</div>
    </div>
  );
};

render(document.body, <App />);
