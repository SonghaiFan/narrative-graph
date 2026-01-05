
import React, { useMemo } from 'react';

interface GridLatticeProps {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  labelWidth: number;
}

export const GridLattice: React.FC<GridLatticeProps> = ({ rows, cols, cellWidth, cellHeight, labelWidth }) => {
  const paths = useMemo(() => {
    const p: React.ReactNode[] = [];
    
    // Loop through columns (Time)
    for (let t = 0; t < cols - 1; t++) {
        // Loop through rows (Tracks)
        for (let h = 0; h < rows; h++) {
            const x1 = labelWidth + t * cellWidth + (cellWidth / 2);
            const y1 = h * cellHeight + (cellHeight / 2);

            // Destinations: (t+1, h), (t+1, h-1), (t+1, h+1)
            const targets = [h, h - 1, h + 1];

            targets.forEach(targetH => {
                if (targetH >= 0 && targetH < rows) {
                    const x2 = labelWidth + (t + 1) * cellWidth + (cellWidth / 2);
                    const y2 = targetH * cellHeight + (cellHeight / 2);
                    
                    p.push(
                        <line
                            key={`lattice-${t}-${h}-${targetH}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#e2e8f0" // slate-200
                            strokeWidth="1.5"
                            // No markerEnd
                        />
                    );
                }
            });
        }
    }
    return p;
  }, [rows, cols, cellWidth, cellHeight, labelWidth]);

  return (
    <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
        {/* No defs needed for markers anymore */}
        {paths}
    </svg>
  );
};
