"use client";

import { useEffect, useState } from "react";

export default function ArtCommissionsPage() {
  const [cameFromWebsite, setCameFromWebsite] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split("; ");

    const sourceCookie = cookies.find(
      (cookie) => cookie.startsWith("art_commissions_source=")
    );

    setCameFromWebsite(sourceCookie?.split("=")[1] === "website");
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="border-2 rounded-[16px] p-6 max-w-[700px] w-full bg-[rgba(0,0,0,0.35)] text-[#f2eef5]">
        <h1 className="text-[32px] tracking-[6px] mb-2">
          art commissions
        </h1>

        <p>
          placeholder page — this confirms the planet routing works.
        </p>

        {cameFromWebsite && (
          <a
            href="/"
            className="inline-block mt-6 underline"
          >
            back to personal website
          </a>
        )}
      </div>
    </main>
  );
}