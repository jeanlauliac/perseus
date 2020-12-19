import { render, useValue, useArray, RxMutValue } from "./perseus/index";

type Task = { id: number; name: string; isDone: RxMutValue<boolean> };

const Spacer = () => {
  return <div style={{ display: "inline-block", width: "10px" }} />;
};

const TaskRow = ({ task, onDelete }: { task: Task; onDelete: () => void }) => {
  const style = {
    textDecoration: task.isDone.map((value) => (value ? "line-through" : null)),
    color: task.isDone.map((value) => (value ? "#aaa" : null)),
    flexGrow: "1",
  };
  return (
    <div
      style={{
        display: "flex",
        width: "400px",
        margin: "10px 0 10px 0",
      }}
    >
      <span style={style}>{task.name}</span>
      &nbsp;
      <button onPress={onDelete}>delete</button>
      <Spacer />
      <button
        style={{ width: "120px" }}
        onPress={() => task.isDone.set(!task.isDone.value)}
      >
        {task.isDone.map((value) => (value ? "restore" : "mark as done"))}
      </button>
    </div>
  );
};

const App = () => {
  const name = useValue<string>("");
  const tasks = useArray<Task>();

  let nid = 1;

  const onPress = () => {
    if (name.value === "") return;
    tasks.push({
      id: nid++,
      name: name.value,
      isDone: useValue(false),
    });
    name.set("");
  };

  return (
    <div style={{ fontSize: "26px" }}>
      <input
        value={name}
        onChange={(ev: InputEvent) =>
          name.set((ev.target as HTMLInputElement).value)
        }
        onKeyPress={(e: KeyboardEvent) => {
          if (e.key === "Enter") onPress();
        }}
        placeholder="What needs to be done?"
      />
      <Spacer />
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
