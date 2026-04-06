import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      {/* Offset content to account for fixed sidebar */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <Header />
        {/* Offset content below fixed header */}
        <main className="flex-1 mt-14 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
