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
        <section id="hero" className="sticky top-0 z-10">
          <Hero />
        </section>
        <section id="work" className="relative z-20">
          <Projects />
        </section>
        <section className="relative z-30 -mt-12 md:-mt-20">
          <Footer />
        </section>
      </div>
    </div>
  );
}

export default App;
