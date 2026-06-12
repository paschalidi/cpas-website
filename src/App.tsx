import { useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Cursor } from './components/Cursor';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Projects } from './components/Projects';
import { Footer } from './components/Footer';
import { BlogList } from './components/BlogList';
import { BlogPost } from './components/BlogPost';
import { ContactPage } from './components/ContactPage';
import InterviewPage from './components/InterviewPage';
import DesignInterviewsPage from './components/DesignInterviewsPage';
import { Analytics } from '@vercel/analytics/react';

function Home() {
  return (
    <div className="flex flex-col">
      <section id="hero" className="sticky top-0 z-10 will-change-transform">
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
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (pathname === '/' && hash) {
      if (hash === '#hero') {
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'instant' });
      }
      return;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
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
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/design-interviews" element={<DesignInterviewsPage />} />
      </Routes>
      <Analytics />
    </div>
  );
}

export default App;
