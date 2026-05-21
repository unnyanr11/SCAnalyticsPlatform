import React from 'react';
import { Sparklines, SparklinesLine } from 'react-sparklines';

interface Props {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

export default function MiniSparkline({ data, positive, width = 64, height = 24 }: Props) {
  const color = positive ? '#10b981' : '#f87171';
  return (
    <Sparklines data={data} width={width} height={height} margin={2}>
      <SparklinesLine color={color} style={{ fill: 'none', strokeWidth: 1.5 }} />
    </Sparklines>
  );
}
