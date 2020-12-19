import { render, useScalar, useArray, MutScalar } from "./perseus/index";

type Task = { id: number; name: string; isDone: MutScalar<boolean> };

const TaskRow = ({ task, onDelete }: { task: Task; onDelete: () => void }) => {
  const style = {
    textDecoration: task.isDone.map((value) => (value ? "line-through" : null)),
    color: task.isDone.map((value) => (value ? "#aaa" : null)),
  };
  return (
    <div>
      <span style={style}>{task.name}</span>
      &nbsp;
      <button onPress={onDelete}>delete</button>
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
      <input
        value={name}
        onChange={(ev: InputEvent) =>
          name.set((ev.target as HTMLInputElement).value)
        }
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
