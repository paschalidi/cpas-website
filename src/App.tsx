// App.tsx
import React from 'react';
import { Cursor } from './components/Cursor';
import { Hero } from './components/Hero';
import { Projects } from "./components/Projects";

function App() {
  return (
    <div className="relative bg-black text-white cursor-none">
      <Cursor />
      <div className="flex flex-col">
        <Hero />
        <Projects />
      </div>
    </div>
  );
}

export default App;