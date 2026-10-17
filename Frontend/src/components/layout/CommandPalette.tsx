import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/store';
import * as projectsApi from '@/api/projects';
import * as tasksApi from '@/api/tasks';
import { mapProject, mapTask } from '@/api/mappers';
import type { Project, Task } from '@/types';
import { Search, X, FolderKanban, CheckSquare, ArrowRight } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const setTaskDrawerId = useStore((s) => s.setTaskDrawerId);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const close = useCallback(() => { setOpen(false); setQuery(''); }, [setOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (!open || !term) {
      setFilteredProjects([]);
      setFilteredTasks([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const allProjects = (await projectsApi.listProjects()).map(mapProject);
          const projects = allProjects
            .filter((project) => project.name.toLowerCase().includes(term.toLowerCase())).slice(0, 4);
          const taskLists = await Promise.all(allProjects.map((project) => tasksApi.listTasks(project.id, { q: term })));
          if (requestId.current !== id) return;
          setFilteredProjects(projects);
          setFilteredTasks(taskLists.flat().map(mapTask).slice(0, 6));
          setSearchError(null);
        } catch (error) {
          if (requestId.current === id) setSearchError(error instanceof Error ? error.message : 'Search failed');
        } finally {
          if (requestId.current === id) setSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen, close]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
              <Search size={16} className="text-zinc-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, tasks…"
                className="flex-1 text-sm bg-transparent text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              )}
              <kbd className="text-[10px] border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-400">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredProjects.length > 0 && (
                <section className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Projects</p>
                  {filteredProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { navigate(`/projects/${p.id}`); close(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors text-left"
                    >
                      <FolderKanban size={14} className="text-indigo-500 flex-shrink-0" />
                      <span className="text-sm text-zinc-800">{p.name}</span>
                      <ArrowRight size={12} className="ml-auto text-zinc-400" />
                    </button>
                  ))}
                </section>
              )}

              {filteredTasks.length > 0 && (
                <section>
                  <p className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Tasks</p>
                  {filteredTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTaskDrawerId(t.id); close(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors text-left"
                    >
                      <CheckSquare size={14} className="text-zinc-400 flex-shrink-0" />
                      <span className="text-sm text-zinc-800 truncate">{t.title}</span>
                    </button>
                  ))}
                </section>
              )}

              {filteredProjects.length === 0 && filteredTasks.length === 0 && (
                <div role={searchError ? 'alert' : undefined} className="py-8 text-center text-sm text-zinc-400">
                  {searchError ?? (searching ? 'Searching…' : query ? 'No results found' : 'Type to search projects and tasks')}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
