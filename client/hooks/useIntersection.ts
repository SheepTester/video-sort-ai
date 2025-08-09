import { useState, useEffect, RefObject } from "react";

export function useIntersection(
  ref: RefObject<Element>,
  options?: IntersectionObserverInit
): [boolean, boolean] {
  const [shouldMount, setShouldMount] = useState(false);
  const [isCurrentlyIntersecting, setIsCurrentlyIntersecting] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCurrentlyIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          setShouldMount(true);
        } else {
          timeoutId = window.setTimeout(() => {
            setShouldMount(false);
          }, 5000);
        }
      },
      options
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [ref, options]);

  return [shouldMount, isCurrentlyIntersecting];
}
