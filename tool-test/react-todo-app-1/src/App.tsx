import { useState, useEffect, useCallback } from 'react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('todos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert createdAt strings back to Date objects
        const todosWithDates = parsed.map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt),
        }));
        setTodos(todosWithDates);
      } catch (e) {
        console.error('Failed to parse todos from localStorage', e);
      }
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = useCallback(() => {
    if (newTodo.trim() === '') return;
    const todo: Todo = {
      id: Date.now().toString(),
      text: newTodo.trim(),
      completed: false,
      createdAt: new Date(),
    };
    setTodos(prev => [todo, ...prev]);
    setNewTodo('');
  }, [newTodo]);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const startEditing = useCallback((todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId && editText.trim() !== '') {
      setTodos(prev =>
        prev.map(todo =>
          todo.id === editingId ? { ...todo, text: editText.trim() } : todo
        )
      );
      setEditingId(null);
      setEditText('');
    }
  }, [editingId, editText]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(todo => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingId) {
        saveEdit();
      } else {
        addTodo();
      }
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>✨ Todo List</h1>
        <p>Organize your tasks with style</p>
      </div>

      <div className="input-section">
        <input
          type="text"
          value={editingId ? editText : newTodo}
          onChange={editingId ? e => setEditText(e.target.value) : e => setNewTodo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={editingId ? 'Edit todo...' : 'Add a new todo...'}
          className="todo-input"
          autoFocus
        />
        {editingId ? (
          <div className="edit-actions">
            <button onClick={saveEdit} className="btn btn-primary">
              ✅ Save
            </button>
            <button onClick={cancelEdit} className="btn btn-secondary">
              ❌ Cancel
            </button>
          </div>
        ) : (
          <button onClick={addTodo} className="btn btn-primary">
            ➕ Add
          </button>
        )}
      </div>

      <div className="stats">
        <span className="stat">
          📋 Total: <strong>{todos.length}</strong>
        </span>
        <span className="stat">
          ⏳ Active: <strong>{activeCount}</strong>
        </span>
        <span className="stat">
          ✅ Completed: <strong>{completedCount}</strong>
        </span>
      </div>

      <div className="filter-section">
        <button
          onClick={() => setFilter('all')}
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
        >
          Completed
        </button>
      </div>

      <div className="todos-container">
        {filteredTodos.length === 0 ? (
          <div className="empty-state">
            <p>No todos {filter === 'all' ? 'yet' : `in ${filter} view`} — add one above! 🚀</p>
          </div>
        ) : (
          <ul className="todos-list">
            {filteredTodos.map(todo => (
              <li
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''} transition-all duration-300`}
              >
                <div className="todo-content">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                    className="todo-checkbox"
                  />
                  {editingId === todo.id ? (
                    <input
                      type="text"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="todo-edit-input"
                      autoFocus
                    />
                  ) : (
                    <span className={`todo-text ${todo.completed ? 'line-through' : ''}`}>
                      {todo.text}
                    </span>
                  )}
                </div>
                <div className="todo-actions">
                  {editingId !== todo.id && (
                    <>
                      <button
                        onClick={() => startEditing(todo)}
                        className="action-btn edit-btn"
                        aria-label="Edit todo"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="action-btn delete-btn"
                        aria-label="Delete todo"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="footer">
        <p>💡 Tip: Press Enter to add or save edits</p>
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899);
          padding: 2rem;
          font-family: 'Segoe UI', system-ui, sans-serif;
          color: #1e293b;
        }

        .header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .header h1 {
          font-size: 2.5rem;
          margin: 0;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .header p {
          color: #e2e8f0;
          font-size: 1.1rem;
          margin-top: 0.5rem;
        }

        .input-section {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .todo-input {
          flex: 1;
          min-width: 200px;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
        }

        .todo-input:focus {
          outline: none;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
        }

        .edit-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn {
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.95rem;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: #94a3b8;
          color: white;
        }

        .btn-secondary:hover {
          background: #64748b;
          transform: translateY(-2px);
        }

        .stats {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .stat {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 12px;
          color: white;
          font-weight: 500;
        }

        .filter-section {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .filter-btn {
          padding: 0.5rem 1.25rem;
          background: rgba(255, 255, 255, 0.15);
          border: none;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .filter-btn:hover:not(.active) {
          background: rgba(255, 255, 255, 0.25);
        }

        .filter-btn.active {
          background: white;
          color: #4f46e5;
          font-weight: 600;
        }

        .todos-container {
          max-width: 600px;
          margin: 0 auto;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #e2e8f0;
          font-style: italic;
        }

        .todos-list {
          list-style: none;
          padding: 0;
        }

        .todo-item {
          background: white;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .todo-item:hover:not(.completed) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        }

        .todo-item.completed {
          opacity: 0.8;
        }

        .todo-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .todo-checkbox {
          width: 1.5rem;
          height: 1.5rem;
          cursor: pointer;
        }

        .todo-text {
          flex: 1;
          font-size: 1.05rem;
          word-break: break-word;
        }

        .todo-edit-input {
          flex: 1;
          padding: 0.25rem 0.5rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 1.05rem;
          outline: none;
        }

        .todo-edit-input:focus {
          border-color: #3b82f6;
        }

        .todo-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          border: none;
          background: #f1f5f9;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: #e2e8f0;
          transform: scale(1.05);
        }

        .edit-btn {
          color: #0ea5e9;
        }

        .delete-btn {
          color: #ef4444;
        }

        .footer {
          text-align: center;
          margin-top: 2rem;
          color: #e2e8f0;
          font-size: 0.9rem;
        }

        @media (max-width: 600px) {
          .app {
            padding: 1rem;
          }
          .header h1 {
            font-size: 2rem;
          }
          .input-section {
            flex-direction: column;
          }
          .edit-actions {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
