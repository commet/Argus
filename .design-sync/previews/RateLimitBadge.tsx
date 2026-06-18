import { useEffect } from 'react';
import { RateLimitBadge } from 'argus';

// RateLimitBadge shows remaining daily proxy quota. It renders nothing until it
// receives an 'argus:ratelimit' CustomEvent (dispatched by the LLM stream handler
// at runtime), and reads it from the shared window — so multiple instances on one
// page all converge to the same value. We therefore show ONE representative cell
// (the near-limit "low" state, which carries the amber warning) rather than a
// variant sweep that would render identically across cells.
export const Default = () => {
  useEffect(() => {
    const id = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('argus:ratelimit', { detail: { remaining: 3 } }));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return <RateLimitBadge />;
};
