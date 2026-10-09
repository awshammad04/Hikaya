import { useEffect, useState } from "react";
import { ApiLocation, DataSource } from "../types";
import { getLocations } from "../services/api";

interface LocationsState {
  locations: ApiLocation[];
  loading: boolean;
  source: DataSource;
  reason?: string;
}

/**
 * Loads the location list once and reports where it came from.
 *
 * Several pages need the same list, and each needs to know whether it is live
 * or sample data, so the fetch and the source flag travel together.
 */
export function useLocations(scope = "jerusalem"): LocationsState {
  const [state, setState] = useState<LocationsState>({
    locations: [],
    loading: true,
    source: "backend",
  });

  useEffect(() => {
    let active = true;

    setState((previous) => ({...previous,loading:true,locations:[]}));
    getLocations(scope)
      .then((result) => {
        if (!active) return;
        setState({
          // A network intermediary can occasionally return a JSON `null`
          // with a successful status. Keep the guide renderable while the
          // request is retried/falls back instead of letting a page read
          // `locations.length` and crash on first mobile load.
          locations: Array.isArray(result.data) ? result.data : [],
          loading: false,
          source: result.source,
          reason: Array.isArray(result.data)
            ? result.reason
            : result.reason ?? "The location collection returned no usable records.",
        });
      })
      .catch(() => {
        if (active) setState((previous) => ({ ...previous, loading: false }));
      });

    return () => {
      // Stops a state update if the page unmounts mid-request.
      active = false;
    };
  }, [scope]);

  return state;
}
