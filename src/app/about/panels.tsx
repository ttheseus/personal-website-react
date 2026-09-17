// =====================================================================
// ABOUT ME — PANEL CONTENT
// =====================================================================
// This is the ONLY file you should need to touch to edit your bio,
// skills, or timeline — or to add a brand new panel.
//
// The 3D room (page.tsx) reads this file to know:
//   - which clickable hotspots to place in the room
//   - where to put them (3D position)
//   - what to show in the popup when someone clicks one
//
// You never need to touch the 3D/camera code in page.tsx for a
// content-only change.
//
// HOW TO ADD A NEW PANEL:
//   1. Write a small content component near the bottom (copy an
//      existing one like BioContent as a template).
//   2. Add one entry to the `panels` array below with a unique id,
//      a title, a 3D position, and your new component as `content`.
//   That's it — a new hotspot box appears in the room automatically,
//   and clicking it opens your new panel.
//
// POSITION FORMAT: [x, y, z]
//   x: left (−) / right (+)
//   y: height off the floor
//   z: toward the back wall (−) / toward the front wall (+)
//   The room floor spans roughly x: -9..9, z: -8..8, so keep hotspots
//   comfortably inside that range (and off the floor, e.g. y: 0.5-1).
// =====================================================================

import type { ReactNode } from "react";

export type PanelDef = {
  id: string;
  title: string;
  position: [number, number, number];
  content: ReactNode;
};

export const panels: PanelDef[] = [
  {
    id: "bio",
    title: "bio",
    position: [-2.4, 0.7, -1.2],
    content: <BioContent />,
  },
  {
    id: "skills",
    title: "skills",
    position: [2.0, 0.7, -0.5],
    content: <SkillsContent />,
  },
  {
    id: "timeline",
    title: "timeline",
    position: [0.0, 0.7, 2.0],
    content: <TimelineContent />,
  },

  // ---- Add new panels below this line, following the same shape ----
  // {
  //   id: "projects",
  //   title: "projects",
  //   position: [-4, 0.7, 3],
  //   content: <ProjectsContent />,
  // },
];

// =====================================================================
// BIO — edit the text below
// =====================================================================
function BioContent() {
  return (
    <div className="space-y-4 leading-relaxed text-[15px]">
      <p>
        hi i'm dorothy! i'm currently a 2nd year comp eng major at the university of waterloo. check my timeline for companies i've worked for :p. this panel is purely my personal life and info for funsies.
      </p>
      <p>
        outside of code, i illustrate under the name yuzu/theo. this
        site, including this room, is a bit of a playground for mixing
        both sides of that. you may have also noticed that there's a link to my art commissions! i have been doing them for about 7 years now, and have a lot of experience dealing with clients. i've worked on webtoons, novels, and indie games before!
      </p>
      <p>
        currently, i want to focus on ways to integrate tech into art. i work a lot with ai and see a lot of discourse surrounding the use of the tool online. i personally believe that the current usage of ai can be modified to help artists as a tool, not replace them. <br></br><br></br>
        some things that interest me: <br></br>
        - art/illustration/animation <br></br>
        - gaming and making games (current favs are little nightmares, hades and arknights endfield) <br></br>
        - writing stories <br></br>
        - astrophysics (especially black holes) <br></br>
        - thinking about the multiverse <br></br>
        - reading sci-fi, dystopian and fantasy novels <br></br>
        - minecraft <br></br>
        <br></br>
        fun facts about me!<br></br>
        - i have a dog named coffee, and really really want a cat <br></br>
        - i like changing the color of my hair every semester. currently, i've dyed it wine red, blond and lavender. right now, it's brown with pink streaks, sort of like draculaura! <br></br>
        - i am working on creating a webcomic <br></br>
        - i have made upwards of 6k from art commissions alone (and spent it all on gacha games) <br></br>
        - i love birds
      </p>

    </div>
  );
}

// =====================================================================
// SKILLS — edit the groups/items below
// =====================================================================
type SkillGroup = {
  category: string;
  items: string[];
};

const skillGroups: SkillGroup[] = [
  {
    category: "languages",
    items: [
      "c++",
      "c#",
      "c",
      "python",
      "javascript",
      "typescript",
      "java",
      "ruby",
      "html",
      "css",
      "sql",
    ],
  },
  {
    category: "frameworks & tools",
    items: [
      "ruby on rails",
      "pytorch",
      "tensorflow",
      "yolov8",
      "cuda programming",
      "ollama",
      "react.js",
      "node.js",
    ],
  },
  {
    category: "other",
    items: ["illustration", "ui/visual design"],
  },
  // Add more groups here — each becomes its own labeled row
];

function SkillsContent() {
  return (
    <div className="space-y-5">
      {skillGroups.map((group) => (
        <div key={group.category}>
          <div className="text-xs tracking-[0.18em] opacity-60 mb-2">
            {group.category}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <span
                key={item}
                className="px-3 py-1 rounded-full bg-black/[0.06] text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// TIMELINE — edit/add entries below (rendered top to bottom, in order)
// =====================================================================
type TimelineCategory = "work" | "projects";

type TimelineItem = {
  category: TimelineCategory;
  date: string;
  title: string;
  description?: string;
};

const timelineItems: TimelineItem[] = [
  // ---- work (jobs, internships, education — most recent first) ----
  {
    category: "work",
    date: "may 2026 – aug 2026",
    title: "software engineering intern, shopify",
    description:
      "shipped 40+ tickets across the full stack on the shopify help center within the customer experience tooling and r&d (cxrnd) team, using ruby on rails.",
  },
  {
    category: "work",
    date: "sept 2025 – dec 2025",
    title: "ai software developer intern, cgi",
    description:
      "built a microservice analyzer llm agent with call mapping & business flow diagrams, using a custom rag indexing 3000+ code files.",
  },
  {
    category: "work",
    date: "jan 2025 – apr 2025",
    title: "ml engineering intern, martinrea international",
    description:
      "developed a cuda-accelerated yolov8 real-time object detection pipeline, trained on 1000+ self-curated images with 5x higher accuracy than the original model.",
  },
  {
    category: "work",
    date: "jul 2023 – aug 2023",
    title: "ai research internship (hip), university of alberta",
    description:
      "trained a 2d cnn in tensorflow for autonomous doom level generation using reinforcement learning, contributing to dr. matthew guzdial's morai maker tool.",
  },
  {
    category: "work",
    date: "sept 2019 – present",
    title: "freelance digital artist, theseus commissions",
    description:
      "delivered 80+ client projects in digital illustration for indie games, novels & webcomics.",
  },

  // ---- projects (most recent first) ----
  {
    category: "projects",
    date: "2025",
    title: "hack the north finalist — s-kbd67",
    description:
      "engineered a nerf gun into a functional fps game controller emulator, powered by an esp32 with mpu6050 gyroscope for mouse control and button-based weapon actions.",
  },
  {
    category: "projects",
    date: "2025 – in progress",
    title: "fateless",
    description:
      "fine-tuning a stable diffusion model to generate accurate character sprites and environments, with a focus on fair artist compensation.",
  },
  // Add more entries here — give each one a category of "work" or
  // "projects" and it'll land in the right section automatically.
];

function TimelineGroup({ items }: { items: TimelineItem[] }) {
  return (
    <div className="space-y-6">
      {items.map((item, i) => (
        <div
          key={`${item.date}-${i}`}
          className="border-l-2 pl-4"
          style={{ borderColor: "rgba(0,0,0,0.12)" }}
        >
          <div className="text-xs tracking-[0.18em] opacity-60">
            {item.date}
          </div>
          <div className="font-medium mt-0.5">{item.title}</div>
          {item.description && (
            <div className="text-sm opacity-70 mt-1">{item.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineContent() {
  const work = timelineItems.filter((item) => item.category === "work");
  const projects = timelineItems.filter((item) => item.category === "projects");

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs tracking-[0.18em] opacity-60 mb-3">work</div>
        <TimelineGroup items={work} />
      </div>
      <div>
        <div className="text-xs tracking-[0.18em] opacity-60 mb-3">
          projects
        </div>
        <TimelineGroup items={projects} />
      </div>
    </div>
  );
}
