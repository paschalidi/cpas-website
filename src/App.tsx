import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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

function ScrollToRouteTarget() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const scrollToTarget = () => {
      if (pathname === '/' && hash) {
        if (hash === '#hero') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const animationFrame = window.requestAnimationFrame(scrollToTarget);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [pathname, hash]);

  return null;
}

function App() {
  return (
    <div className="relative bg-black text-white cursor-none">
      <ScrollToRouteTarget />
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
