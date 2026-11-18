export function SegmentationHeroVisual() {
  return (
    <figure
      className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-[0_12px_36px_-16px_rgba(23,23,23,0.08)] overflow-hidden"
      aria-label="Conceptual diagram of layered biomedical waste image segmentation contours and classification pipeline stages"
    >
      {/* Top Specimen Frame Bar */}
      <div className="px-5 py-3.5 border-b border-[#E5E5E5] bg-[#FCFBF9] flex items-center justify-between gap-4">
        <span className="font-mono text-[11px] font-medium tracking-[0.08em] uppercase text-[#525252]">
          Segmentation Contour Study
        </span>
        <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
          RGB · Contour Mask · Policy Gate
        </span>
      </div>

      {/* Abstract Biomedical Contour Geometry — Zero Fabricated Scores or Predictions */}
      <div className="relative bg-[#FCFBF9] p-4 sm:p-6">
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] overflow-hidden">
          <svg
            viewBox="0 0 520 340"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto block"
            role="img"
            aria-label="Layered organic contour regions illustrating visual image segmentation boundaries"
          >
            {/* Coordinate Reference Grid (hidden on tiny screens via opacity subtlety, lightweight vector) */}
            <g stroke="#E5E5E5" strokeWidth="0.75">
              <line x1="104" y1="0" x2="104" y2="340" />
              <line x1="208" y1="0" x2="208" y2="340" />
              <line x1="312" y1="0" x2="312" y2="340" />
              <line x1="416" y1="0" x2="416" y2="340" />
              <line x1="0" y1="68" x2="520" y2="68" />
              <line x1="0" y1="136" x2="520" y2="136" />
              <line x1="0" y1="204" x2="520" y2="204" />
              <line x1="0" y1="272" x2="520" y2="272" />
            </g>

            {/* Calibration Frame Marks */}
            <path d="M24 38V24H38" stroke="#D4D4D4" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M482 24H496V38" stroke="#D4D4D4" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M24 302V316H38" stroke="#D4D4D4" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M482 316H496V302" stroke="#D4D4D4" strokeWidth="1.5" strokeLinecap="round" />

            {/* Outer Organic Region Contour (Soft Structural Layer) */}
            <path
              d="M116 178C104 128 140 76 196 68C252 60 288 86 336 92C384 98 424 134 416 184C408 234 364 274 304 278C244 282 204 258 164 244C128 232 126 220 116 178Z"
              fill="#F7F5F2"
              stroke="#D4D4D4"
              strokeWidth="1.25"
            />

            {/* Secondary Isolating Contour Wave */}
            <path
              d="M148 176C140 138 172 98 220 96C268 94 316 112 356 132C390 149 396 192 372 222C344 256 284 260 236 248C188 236 156 212 148 176Z"
              fill="#4338CA"
              fillOpacity="0.05"
              stroke="#6366F1"
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />

            {/* Primary Indigo Segmentation Boundary */}
            <path
              d="M188 168C186 136 214 114 252 118C288 122 332 142 338 178C344 214 304 236 262 232C220 228 190 202 188 168Z"
              fill="#4338CA"
              fillOpacity="0.09"
              stroke="#4338CA"
              strokeWidth="2"
            />

            {/* Secondary Sub-Region Contour (Distinct Geometry) */}
            <path
              d="M276 196C276 178 294 166 316 168C338 170 356 186 352 206C348 226 326 236 306 232C288 228 276 214 276 196Z"
              fill="#FFFFFF"
              fillOpacity="0.75"
              stroke="#4338CA"
              strokeWidth="1.5"
            />

            {/* Precision Bounding Envelope & Segmentation Axis */}
            <rect
              x="174"
              y="108"
              width="192"
              height="136"
              rx="8"
              stroke="#171717"
              strokeOpacity="0.28"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Restrained Organic Wave Sweep */}
            <path
              d="M52 202C116 174 176 226 248 196C312 170 374 134 468 158"
              stroke="#6366F1"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Boundary Anchor Nodes */}
            <circle cx="188" cy="168" r="3.5" fill="#4338CA" />
            <circle cx="252" cy="118" r="3.5" fill="#6366F1" />
            <circle cx="338" cy="178" r="3.5" fill="#4338CA" />
            <circle cx="316" cy="168" r="3" fill="#171717" />
          </svg>
        </div>
      </div>

      {/* Caption Strip — Unboxed Typographic Metadata */}
      <figcaption className="px-5 py-3.5 border-t border-[#E5E5E5] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
        <span>Visual boundary isolation prior to candidate scoring</span>
        <span className="font-mono text-[11px] text-[#525252]">
          Assistive Review Architecture
        </span>
      </figcaption>
    </figure>
  );
}
