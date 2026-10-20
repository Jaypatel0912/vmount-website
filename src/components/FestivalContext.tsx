import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchFestival, isRunning, offerBikes, type Festival, type OfferBike } from "../data/festival";

type FestivalState = { festival: Festival | null; offers: Map<string, OfferBike> };

const FestivalCtx = createContext<FestivalState>({ festival: null, offers: new Map() });

/** Loads the published festival offer and shares it with the page.
 *  It shows only between its start and end dates; add ?preview-offer to the address to see it early. */
export function FestivalProvider({ children }: { children: ReactNode }) {
  const [festival, setFestival] = useState<Festival | null>(null);

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).has("preview-offer");
    fetchFestival()
      .then((f) => setFestival(f && (preview || isRunning(f)) ? f : null))
      .catch(() => setFestival(null));
  }, []);

  const value = useMemo(
    () => ({ festival, offers: new Map((festival ? offerBikes(festival) : []).map((b) => [b.id, b])) }),
    [festival],
  );
  return <FestivalCtx.Provider value={value}>{children}</FestivalCtx.Provider>;
}

export const useFestival = () => useContext(FestivalCtx);
