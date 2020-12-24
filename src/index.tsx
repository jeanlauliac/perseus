import {
  render,
  useValue,
  useArray,
  RxMutValue,
  if_,
  map,
  zip,
  RxValue,
} from "./perseus/index";

type Task = {
  id: number;
  name: RxMutValue<string>;
  isDone: RxMutValue<boolean>;
};

const Spacer = () => {
  return <div style={{ display: "inline-block", width: "10px" }} />;
};

const TaskRow = ({
  task,
  onDelete,
  onEdit,
  isEditing,
}: {
  task: Task;
  onDelete: () => void;
  onEdit: () => void;
  isEditing: RxValue<boolean>;
}) => {
  const blockStyle = {
    display: "flex",
    width: "400px",
    margin: "10px 0 10px 0",
  };

  const style = {
    textDecoration: if_(task.isDone, "line-through"),
    color: if_(task.isDone, "#aaa"),
    flexGrow: "1",
  };

  const onDone = () => task.isDone.set(!task.isDone.value);

  const onSave = () => {
    task.name.set(newName.value);
    onEdit();
  };

  const newName = useValue(task.name.value);
  const nameOrEditor = map(isEditing, (value) => {
    if (!value) return <span style={style}>{task.name}</span>;

    newName.set(task.name.value);
    return (
      <input
        value={newName}
        onChange={(ev: InputEvent) =>
          newName.set((ev.target as HTMLInputElement).value)
        }
        onKeyPress={(e: KeyboardEvent) => {
          if (e.key === "Enter") onSave();
        }}
      />
    );
  });

  return (
    <div style={blockStyle}>
      {nameOrEditor}
      &nbsp;
      {if_(
        isEditing,
        <button onPress={onSave}>save</button>,
        <button onPress={onEdit}>edit</button>
      )}
      <Spacer />
      <button onPress={onDelete}>delete</button>
      <Spacer />
      <button style={{ width: "120px" }} onPress={onDone}>
        {if_(task.isDone, "restore", "mark as done")}
      </button>
    </div>
  );
};

const TaskInput = ({
  name,
  onPress,
}: {
  name: RxMutValue<string>;
  onPress: () => void;
}) => {
  return (
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
  );
};

const App = () => {
  const name = useValue<string>("");
  const tasks = useArray<Task>();
  const editingTask = useValue<Task | null>(null);

  let nid = 1;

  const onPress = () => {
    if (name.value === "") return;
    tasks.push({
      id: nid++,
      name: useValue(name.value),
      isDone: useValue(false),
    });
    name.set("");
  };

  return (
    <div style={{ fontSize: "26px" }}>
      <TaskInput name={name} onPress={onPress} />
      <Spacer />
      <button onPress={onPress}>Add task</button>
      {tasks.map((task) => {
        return (
          <TaskRow
            task={task}
            onDelete={() => {
              tasks.splice(tasks.indexOf(task), 1);
              if (editingTask.value === task) editingTask.set(null);
            }}
            onEdit={() => {
              if (editingTask.value !== task) {
                editingTask.set(task);
              } else {
                editingTask.set(null);
              }
            }}
            isEditing={map(editingTask, (value) => task === value)}
          />
        );
      })}
      <div>{tasks.length} items</div>
    </div>
  );
};

render(document.body, <App />);
