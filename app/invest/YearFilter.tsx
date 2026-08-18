"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function YearFilter({ currentYear }: { currentYear: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(thisYear - i));

  function onChange(val: string) {
    const p = new URLSearchParams(params.toString());
    p.set("year", val);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="investYearFilter">
      <span>Period</span>
      <div className="investYearChips">
        {["all", ...years].map(y => (
          <button
            key={y}
            className={`investYearChip${currentYear === y ? " active" : ""}`}
            onClick={() => onChange(y)}
          >
            {y === "all" ? "All time" : y}
          </button>
        ))}
      </div>
    </div>
  );
}
