import { Cursor } from './components/Cursor';
import { Hero } from './components/Hero';

function App() {
  return (
    <div className="min-h-screen bg-black text-white cursor-none">
      <Cursor />
      <Hero />
    </div>
  );
}

export default App;