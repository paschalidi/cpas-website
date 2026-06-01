import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

type NavLink = {
  label: string;
  href: string;
  hash?: string;
};

const navLinks: NavLink[] = [
  { label: 'About', href: '/#hero', hash: '#hero' },
  { label: 'Work', href: '/#work', hash: '#work' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/#contact', hash: '#contact' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToHash = (hash: string) => {
    if (hash === '#hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, link: NavLink) => {
    if (link.hash && isHome) {
      e.preventDefault();
      window.history.pushState(null, '', link.href);
      scrollToHash(link.hash);
    }

    setMenuOpen(false);
  };

  const renderLink = (link: NavLink) => {
    const classes = `
      relative px-5 py-2.5 rounded-full
      text-sm font-medium text-white
      transition-all duration-300 ease-out
      hover:text-white hover:bg-white/10
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
    `;

    return (
      <Link
        key={link.href}
        to={link.href}
        onClick={(e) => handleClick(e, link)}
        className={classes}
        style={{ cursor: 'none' }}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <>
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
        <div className="hidden md:flex items-center">
          {navLinks.map(renderLink)}
        </div>

        {isHome ? (
          <a
            href="#hero"
            onClick={(e) => handleClick(e, navLinks[0])}
            className="md:hidden px-5 py-2.5 text-sm font-medium text-white"
            style={{ cursor: 'none' }}
          >
            Top
          </a>
        ) : (
          <Link
            to="/#hero"
            className="md:hidden px-5 py-2.5 text-sm font-medium text-white"
            style={{ cursor: 'none' }}
          >
            Top
          </Link>
        )}

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
          {navLinks.map((link) => {
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={(e) => handleClick(e, link)}
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
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
