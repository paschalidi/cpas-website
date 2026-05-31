// App.tsx
import React from 'react';
import { Cursor } from './components/Cursor';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Projects } from "./components/Projects";
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="relative bg-black text-white cursor-none">
      <Cursor />
      <Navbar />
      <div className="flex flex-col">
        <section id="hero">
          <Hero />
        </section>
        <section id="work">
          <Projects />
        </section>
        <Footer />
      </div>
    </div>
  );
}

export default App;
