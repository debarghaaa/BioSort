import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import type { CandidatePrediction } from '../../types/platform';
import { formatScore } from '../../utils/formatters';
import { resolveWasteCategoryVisual } from '../../utils/wasteCategories';

export function ConfidenceDisplay({
  candidates,
}: {
  candidates: CandidatePrediction[];
}) {
  const { getCategoryAppearance } = usePlatformConfig();

  if (candidates.length === 0) {
    return (
      <p className="oi-tile oi-component-subtitle">
        No candidate predictions were returned.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="oi-subpanel-title">Candidate Predictions</h4>
        <span className="oi-metadata">
          Model score vs. calibrated confidence (not accuracy).
        </span>
      </div>

      <div className="oi-inset-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead className="border-b border-[#E5E5E5] bg-[#FFFFFF] text-[#737373]">
            <tr>
              <th className="text-left font-medium px-3.5 py-2.5">Candidate Class</th>
              <th className="text-right font-medium px-3.5 py-2.5">Model Score</th>
              <th className="text-right font-medium px-3.5 py-2.5">Calibrated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {candidates.map((cand) => {
              const app = getCategoryAppearance(cand.class_name);
              const visual = resolveWasteCategoryVisual(cand.class_name, app?.color_hex);
              const Icon = visual.icon;
              const pct = Math.max(
                0,
                Math.min(100, (cand.calibrated_confidence ?? cand.model_score) * 100)
              );
              return (
                <tr key={cand.class_name} className="bg-[#FFFFFF]">
                  <td className="px-3.5 py-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 font-mono text-[#171717]">
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-md border shrink-0"
                          style={{
                            backgroundColor: visual.bgTintHex,
                            borderColor: visual.borderHex,
                            color: visual.textHex,
                          }}
                          aria-hidden="true"
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                        <span className="font-medium">
                          {app?.display_label || cand.class_name}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#EFECE6] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#4338CA] transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[#171717]">
                    {formatScore(cand.model_score)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[#737373]">
                    {cand.calibrated_confidence !== null
                      ? formatScore(cand.calibrated_confidence)
                      : 'Not calibrated'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
