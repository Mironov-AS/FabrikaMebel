import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  // Auto-collapse on tablet-sized screens (< 1024px)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.innerWidth < 1024
  );

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      {/* Offset content to account for fixed sidebar */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'ml-14' : 'ml-60'
        }`}
      >
        <Header isCollapsed={sidebarCollapsed} />
        {/* Offset content below fixed header */}
        <main className="flex-1 mt-14 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
