import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'About', href: '#hero' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href === '#hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setMenuOpen(false);
  };

  return (
    <>
      {/* Desktop + Mobile Floating Pill Nav */}
      <nav
        className={`
          fixed top-4 left-1/2 -translate-x-1/2 z-50
          flex items-center gap-1
          px-2 py-2
          rounded-full
          border border-white/10
          transition-all duration-500 ease-out
          ${scrolled
            ? 'bg-black/70 backdrop-blur-2xl shadow-lg shadow-black/10'
            : 'bg-black/50 backdrop-blur-xl'
          }
        `}
        style={{ cursor: 'none' }}
      >
        {/* Desktop links */}
        <div className="hidden md:flex items-center">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleClick(e, link.href)}
              className="
                relative px-5 py-2.5 rounded-full
                text-sm font-medium text-white
                transition-all duration-300 ease-out
                hover:text-white hover:bg-white/10
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
              "
              style={{ cursor: 'none' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Mobile: show only first link (name) + hamburger */}
        <a
          href="#hero"
          onClick={(e) => handleClick(e, '#hero')}
          className="md:hidden px-5 py-2.5 text-sm font-medium text-white"
          style={{ cursor: 'none' }}
        >
          Christos
        </a>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="
            md:hidden p-2.5 rounded-full
            text-white hover:text-white hover:bg-white/10
            transition-all duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
          "
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          style={{ cursor: 'none' }}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div
          className="
            fixed inset-0 z-40
            flex flex-col items-center justify-center gap-6
            bg-black/95 backdrop-blur-xl
            animate-in fade-in duration-300
          "
          style={{ cursor: 'none' }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleClick(e, link.href)}
              className="
                px-8 py-4 rounded-full
                text-2xl font-medium text-white
                hover:text-white hover:bg-white/10
                transition-all duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
              "
              style={{ cursor: 'none' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
