import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';

function App() {
  return (
    <div className="flex h-screen w-full flex-col bg-gray-900 text-white">
      {/* Our persistent navigation bar */}
      <Navbar />

      {/* This is where the routed page component will be rendered */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default App;