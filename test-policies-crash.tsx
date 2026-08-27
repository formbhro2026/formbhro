import React from "react";
import { renderToString } from "react-dom/server";
import { format } from "date-fns";

const policies = [
  {
    id: "1",
    type: "terms",
    version: "1.0",
    content: null,
    is_active: false,
    published_at: null,
    created_at: null,
  },
  {
    id: "2",
    type: "help",
    version: null,
    content: "hi",
    is_active: null,
    published_at: "2026-08-27T15:54:41.07637+00:00",
    created_at: "2026-08-27T15:54:41.07637+00:00"
  }
];

function TestComponent() {
  return (
    <div>
      {policies.map(policy => {
        const dateStr = policy.published_at || policy.created_at;
        const d = dateStr ? new Date(dateStr) : null;
        return (
          <div key={policy.id}>
            <h3>{policy.type} Policy</h3>
            <span>v{policy.version}</span>
            {policy.is_active && <span>Active</span>}
            <div>
              {(!d || isNaN(d.getTime())) ? "Invalid Date" : format(d, "PPP p")}
            </div>
            <div>{policy.content}</div>
          </div>
        );
      })}
    </div>
  );
}

try {
  console.log(renderToString(<TestComponent />));
} catch (e) {
  console.error("CRASHED:", e);
}
