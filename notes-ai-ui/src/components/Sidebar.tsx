interface SidebarProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
  onMemoryOpen: () => void;
  onSettingsOpen: () => void;
}

const navItems = [
  { id: 'new', label: 'New Notes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'history', label: 'History', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'memory', label: 'Memory', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg> },
  { id: 'settings', label: 'Settings', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1 1.51z"/></svg> },
];

export function Sidebar({ activeNav, onNavChange, onMemoryOpen, onSettingsOpen }: SidebarProps) {
  const handleClick = (id: string) => {
    if (id === 'memory') { onMemoryOpen(); return; }
    if (id === 'settings') { onSettingsOpen(); return; }
    onNavChange(id);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 8c.7-.7 3-2 3-5.5a5.5 5.5 0 0 0-11 0c0 3.5 2.3 4.8 3 5.5"/>
            <path d="M14 14c-.7-.7-3-2-3-5.5a5.5 5.5 0 0 1 11 0c0 3.5-2.3 4.8-3 5.5"/>
            <path d="M8 20c1.1 1.3 2.5 2 4 2s2.9-.7 4-2"/>
          </svg>
        </div>
        <div>
          <h1 className="sidebar-title">Video Notes <span className="sidebar-ai">AI</span></h1>
          <p className="sidebar-subtitle">Turn any video into smart notes</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => handleClick(item.id)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
