import React from 'react';
import { Card, CardContent } from "./ui/card";

export const ProjectCard = ({
                              title,
                              src,
                              companyName,
                              duration,
                              technologies,
                              url
                            }: {
  title: string;
  src: string;
  companyName: string;
  duration: string;
  technologies: string[];
  url?: string;
}) => {
  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-transform duration-300 hover:-translate-y-1"
        >
          {children}
        </a>
      );
    }
    return <>{children}</>;
  };

  return (
    <CardWrapper>
      <Card className="group bg-black/20 border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-black/30 rounded-2xl">
        <div className="relative w-full h-[20rem] overflow-hidden rounded-t-2xl rounded-b-lg">
          <img
            src={src}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60"/>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-semibold text-white/90">{title}</h3>
            <p className="text-sm text-white/60 mt-1">{companyName} · {duration}</p>
          </div>
        </div>

        <CardContent className="pt-6 px-4">
          <div className="flex flex-wrap gap-2">
            {technologies.map((tech, index) => (
              <span
                key={index}
                className="px-2 py-1 text-sm rounded-full bg-purple-500/10 text-purple-200/80 backdrop-blur-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </CardWrapper>
  );
};

export function Projects() {
  const projects = [
    {
      title: "Rechat.cloud - SaaS Chat System",
      companyName: "Open Source Project",
      duration: "2024",
      technologies: ["Rust", "Terraform", "Kubernetes", "PostgreSQL", "Next.js", "Stripe API"],
      src: '/images/rechat.png',
      url: 'https://www.rechat.cloud'
    },
    {
      title: "Electrical Vehicle Marketplace",
      companyName: "Ever Cars",
      duration: "18 months",
      technologies: ["Golang", "AWS", "Next.js", "OpenSearch", "PostgreSQL", "Docker"],
      src: '/images/ever.png',
      url: 'https://evercars.com'
    },
    {
      title: "Freelance Booking Platform",
      companyName: "Hirespace",
      duration: "18 months",
      technologies: ["NeonDB", "Next.js", "Prisma", "TypeScript", "Docker", "TailwindCSS"],
      src: '/images/hirespace.png',
      url: 'https://hirespace.io'
    },
    {
      title: "Telehealth Platform",
      companyName: "SesameCare",
      duration: "2 years",
      technologies: ["AWS", "Terraform", "GCP", "Docker", "Kubernetes", "Stripe API"],
      src: '/images/sesame.png',
      url: 'https://sesamecare.com'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br py-20">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="font-sans text-4xl font-bold mb-24 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
          Have worked on
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <ProjectCard key={index} {...project} />
          ))}
        </div>
      </div>
    </div>
  );
}