import React from 'react';

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

const ToptalIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M20.227 10.038L10.188 0l-2.04 2.04 3.773 3.769-8.155 8.153L13.807 24l2.039-2.039-3.772-3.771 8.16-8.152h-.007zM8.301 14.269l6.066-6.063 1.223 1.223-6.064 6.113-1.223-1.26-.002-.013z" />
  </svg>
);

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M12 12.713l-11.985-9.713h23.971l-11.986 9.713zm-5.425-1.822l-6.575-5.329v12.501l6.575-7.172zm10.85 0l6.575 7.172v-12.501l-6.575 5.329zm-1.557 1.261l-3.868 3.135-3.868-3.135-8.11 8.848h23.956l-8.11-8.848z"/>
  </svg>
);

const socialLinks = [
  { icon: <GithubIcon/>, href: "https://github.com/paschalidi", label: "GitHub" },
  { icon: <LinkedInIcon/>, href: "https://www.linkedin.com/in/christos-paschalidis/", label: "LinkedIn" },
  { icon: <ToptalIcon/>, href: "https://www.toptal.com/resume/christos-paschalidis", label: "Toptal" },
  { icon: <EmailIcon/>, href: "mailto:paschalidi@outlook.com?subject=Let's%20work%20together&body=Hi%20Christos%2C%0A%0AI%20came%20across%20your%20work%20and%20I%27d%20love%20to%20explore%20the%20possibility%20of%20collaborating.%0A%0ALooking%20forward%20to%20connecting.", label: "Email" },
];

export function Footer() {
  return (
    <footer
      id="contact"
      className="relative w-full cursor-none"
    >
      <div className="relative overflow-hidden rounded-t-[3rem] md:rounded-t-[5rem] bg-forest-950">
        {/* Warm top edge glow — peach/coral gradient line */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgb(var(--color-peach-300) / 0.9), rgb(var(--color-peach-200) / 0.7), rgb(var(--color-cream-50) / 0.8), rgb(var(--color-peach-200) / 0.7), rgb(var(--color-peach-300) / 0.9), transparent)',
            boxShadow: '0 0 20px rgb(var(--color-peach-300) / 0.3)',
          }}
        />

        {/* Subtle warm ambient glow at bottom */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60rem] h-[20rem] rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgb(var(--color-peach-300) / 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Shining line at bottom — a beacon of light */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgb(var(--color-peach-300) / 0.7) 15%, rgb(var(--color-cream-50) / 0.9) 50%, rgb(var(--color-peach-300) / 0.7) 85%, transparent 100%)',
            boxShadow: '0 0 15px rgb(var(--color-peach-300) / 0.2)',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:pt-28 md:pb-16">
          {/* CTA area */}
          <div className="mb-4 md:mb-6">
            <h3 className="font-sans text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-6 max-w-xl">
              Let&apos;s build something together
            </h3>
            <a
              href="mailto:paschalidi@outlook.com?subject=Let's%20work%20together&body=Hi%20Christos%2C%0A%0AI%20came%20across%20your%20work%20and%20I%27d%20love%20to%20explore%20the%20possibility%20of%20collaborating.%0A%0ALooking%20forward%20to%20connecting."
              className="
                inline-flex items-center gap-2
                px-6 py-3 rounded-full
                bg-white/10 text-white
                hover:bg-white/20 hover:-translate-y-0.5
                transition-all duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peach-300 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950
              "
            >
              <EmailIcon />
              <span className="text-sm font-semibold">Get in touch</span>
            </a>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-white/8 mb-12" />

          {/* Bottom row */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {/* Social links */}
            <div className="flex items-center gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="
                    p-3 rounded-full
                    text-white/50
                    hover:text-white hover:bg-white/10 hover:-translate-y-0.5
                    transition-all duration-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peach-300 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950
                  "
                >
                  {link.icon}
                </a>
              ))}
            </div>

            {/* Copyright */}
            <div className="text-white/30 text-sm">
              <p>© {new Date().getFullYear()} Christos Paschalidis</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
