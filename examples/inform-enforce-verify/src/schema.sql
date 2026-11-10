CREATE TABLE IF NOT EXISTS inventory (
  item_id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  reserved_minimum INTEGER NOT NULL CHECK (reserved_minimum >= 0),
  CHECK (quantity >= reserved_minimum)
) STRICT;

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY
) STRICT;

CREATE TABLE IF NOT EXISTS scout_inventory (
  task_id TEXT NOT NULL REFERENCES tasks(task_id),
  item_id TEXT NOT NULL REFERENCES inventory(item_id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (task_id, item_id)
) STRICT;

CREATE TABLE IF NOT EXISTS operations (
  operation_id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(task_id),
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  result TEXT NOT NULL
) STRICT;
