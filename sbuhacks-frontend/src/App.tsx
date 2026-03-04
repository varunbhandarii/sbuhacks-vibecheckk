import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';

function App() {
  return (
    <div className="flex h-screen w-full flex-col bg-black text-white font-sans antialiased">
      <Navbar />
      <main className="flex-1 overflow-y-auto mono-scrollbar">
        <Outlet />
      </main>
    </div>
  );
}

export default App;