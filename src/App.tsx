import { Routes, Route } from 'react-router-dom';
import { Cursor } from './components/Cursor';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Projects } from './components/Projects';
import { Footer } from './components/Footer';
import { BlogList } from './components/BlogList';
import { BlogPost } from './components/BlogPost';

function Home() {
  return (
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
  );
}

function App() {
  return (
    <div className="relative bg-black text-white cursor-none">
      <Cursor />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Routes>
    </div>
  );
}

export default App;
