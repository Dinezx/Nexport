import { useEffect, useRef } from "react";

/**
 * Hook that reveals elements when they scroll into view.
 * Adds the "revealed" class when intersecting.
 */
export function useScrollReveal(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revealed");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold, rootMargin: "0px 0px -40px 0px" }
        );

        // observe the container and any children that have .reveal
        observer.observe(el);
        el.querySelectorAll(".reveal").forEach((child) => observer.observe(child));

        return () => observer.disconnect();
    }, [threshold]);

    return ref;
}
