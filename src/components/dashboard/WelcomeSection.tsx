import { useEffect, useState } from "react";
import { useUserStore } from "@/lib/user-store";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export function WelcomeSection() {
  const { profile } = useUserStore();
  const [hello, setHello] = useState("Welcome");

  useEffect(() => setHello(greeting()), []);

  return (
    <section>
      <h1 className="text-xl font-extrabold tracking-tight text-text sm:text-2xl">
        {hello}, {profile.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">How can we help you today?</p>
    </section>
  );
}
