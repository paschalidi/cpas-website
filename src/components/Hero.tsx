import { useEffect, useRef } from 'react';

// Custom icon components for better styling
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

const ToptalIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M20.227 10.038L10.188 0l-2.04 2.04 3.773 3.769-8.155 8.153L13.807 24l2.039-2.039-3.772-3.771 8.16-8.152h-.007zM8.301 14.269l6.066-6.063 1.223 1.223-6.064 6.113-1.223-1.26-.002-.013z" />
  </svg>
);

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path
      d="M12 12.713l-11.985-9.713h23.971l-11.986 9.713zm-5.425-1.822l-6.575-5.329v12.501l6.575-7.172zm10.85 0l6.575 7.172v-12.501l-6.575 5.329zm-1.557 1.261l-3.868 3.135-3.868-3.135-8.11 8.848h23.956l-8.11-8.848z"/>
  </svg>
);

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;

      if (textRef.current) {
        textRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };

    container.addEventListener('mousemove', onMouseMove);
    return () => container.removeEventListener('mousemove', onMouseMove);
  }, []);

  const socialLinks = [
    {
      icon: <GithubIcon />,
      href: "https://github.com/paschalidi",
      label: "Github"
    },
    {
      icon: <LinkedInIcon />,
      href: "https://www.linkedin.com/in/christos-paschalidis/",
      label: "LinkedIn"
    },
    {
      icon: <ToptalIcon />,
      href: "https://www.toptal.com/resume/christos-paschalidis",
      label: "Toptal"
    },
    {
      icon: <EmailIcon />,
      href: "mailto:paschalidi@outlook.com",
      label: "Email"
    }
  ];

  return (
    <div ref={containerRef} className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-purple-900/5 to-blue-900/10"/>
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-indigo-600/5"/>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,0.1),rgba(0,0,0,0.98))]"/>
      </div>
      <div ref={textRef} className="relative z-10 text-center transition-transform duration-200 ease-out">
        <h1 className="text-8xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
          christos
        </h1>
        <p className="text-xl text-white/60">
          another software developer afraid of losing his job to AI
        </p>
        <p className="text-xl text-white/60">
          until then building this website using AI, because time is of essence
        </p>

        <div className="mt-12 flex items-center justify-center gap-8">
          {socialLinks.map((link, index) => (
            <a
              key={index}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative p-4 hover:-translate-y-1 transition-all duration-300 cursor-none"
              aria-label={link.label}
            >
              <div className="absolute inset-0 transition-all duration-300" />
              <div className="relative flex flex-col items-center gap-2">
                <div  >
                  {link.icon}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}