import React from 'react';
import { Card, CardContent } from "./ui/card";

// Single warm badge color
const BADGE_BG = '#fef0e6';
const BADGE_TEXT = '#0d2418';


const CardWrapper = ({
  url,
  children,
}: {
  url?: string;
  children: React.ReactNode;
}) => {
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

export const ProjectCard = ({
  title,
  src,
  companyName,
  workTitle,
  technologies,
  url,
}: {
  title: string;
  src: string;
  companyName: string;
  workTitle: string;
  technologies: string[];
  url?: string;
}) => {
  return (
    <CardWrapper url={url}>
      <Card
        className="group bg-white border border-[#f5a885]/15 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-[#f5a885]/10 rounded-[2rem] overflow-hidden"
        style={{ cursor: 'none' }}
      >
        <div className="relative w-full h-[16rem] md:h-[18rem] overflow-hidden rounded-t-[2rem]">
          <img
            src={src}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>

        <CardContent className="pt-5 px-5 pb-6">
          <h3 className="text-lg md:text-xl font-semibold text-[#0d2418] leading-tight">{title}</h3>
          <p className="text-sm text-[#8a8a8a] mt-1.5 mb-5">{companyName} · {workTitle}</p>

          <div className="flex flex-wrap gap-2">
            {technologies.map((tech, i) => (
              <span
                key={i}
                className="px-3 py-1.5 text-xs font-medium rounded-full "
                style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
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
      workTitle: "Founder Fullstack Engineer",
      technologies: ["Rust", "Terraform", "Kubernetes", "PostgreSQL", "Next.js", "Stripe API"],
      src: '/images/rechat.png',
      url: 'https://www.rechat.cloud'
    },
    {
      title: "Largest US Marketplace for Electrical Vehicles",
      companyName: "Ever Cars",
      workTitle: "Fullstack Engineer",
      technologies: ["Golang", "AWS", "Next.js", "OpenSearch", "PostgreSQL", "Docker"],
      src: '/images/ever.png',
      url: 'https://evercars.com'
    },
    {
      title: "Booking Platform for Freelancers",
      companyName: "HireSpace",
      workTitle: "Founding Fullstack Engineer",
      technologies: ["NeonDB", "Next.js", "Prisma", "TypeScript", "Docker"],
      src: '/images/hirespace.png',
      url: 'https://hirespace.io'
    },
    {
      title: "NGO Coding Bootcamp for migrants",
      companyName: "Redi School",
      workTitle: "DevOps Engineer",
      technologies: ["Terraform", "Azure", "Github Actions", "PostgreSQL", "Docker"],
      src: '/images/redi.png',
      url: 'https://www.redi-school.org/redi-school-berlin'
    },
    {
      title: "Carbon Offset Platform",
      companyName: "Offset",
      workTitle: "Founder Engineer",
      technologies: ["Nextjs", "React", "PostgreSQL", "Docker"],
      src: '/images/offset3.png',
      url: 'https://offset.org/'
    },
    {
      title: "Largest US Telehealth Platform",
      companyName: "SesameCare",
      workTitle: "Software Engineer",
      technologies: ["Terraform", "GCP", "Docker", "Kubernetes", "Stripe API", "Next.js"],
      src: '/images/sesame.png',
      url: 'https://sesamecare.com'
    },
    {
      title: "E2EE Healthcare Platform",
      companyName: "Vivy GmbH",
      workTitle: "Software Engineer",
      technologies: ["AWS", "Jenkins", "React", "Typescript", "Node.js"],
      src: '/images/vivy.png',
      url: 'https://vivy.com'
    },
    {
      title: "Health information management system",
      companyName: "DHIS2",
      workTitle: "Fullstack Engineer",
      technologies: ["Next.js", "Typescript", "Node.js", "Open Source"],
      src: '/images/dhis2.png',
      url: 'https://dhis2.org'
    },
  ];

  return (
    <section
      className="relative bg-[#fcfaf5] rounded-t-[3rem] md:rounded-t-[5rem] overflow-hidden"
      style={{ cursor: 'none' }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-20 md:pt-28 pb-40 md:pb-56">
        {/* Section heading */}
        <div className="mb-16 md:mb-20 text-center">
          <h2 className="font-sans text-5xl md:text-7xl font-bold text-[#0d2418] leading-[1.1] mb-5">
            Selected Work
          </h2>
          <p className="text-[#6b6b6b] text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
            Products and platforms I&apos;ve helped build
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          {projects.map((project, index) => (
            <ProjectCard key={index} {...project} />
          ))}
        </div>
      </div>
    </section>
  );
}
