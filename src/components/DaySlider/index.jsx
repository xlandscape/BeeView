import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedTimePoint } from '../../store/timeSlice';
import './DaySlider.css';

/**
 * Compact day scrubber for the chart drawer header. Works while the drawer is
 * collapsed; per-day values come from the local forage matrices, so scrubbing
 * issues no requests.
 */
export default function DaySlider() {
  const dispatch = useDispatch();
  const day = useSelector((state) => state.time.selectedTimePoint) || 1;
  const dayCount = useSelector((state) => state.time.dayCount) || 365;

  const set = (value) => dispatch(setSelectedTimePoint(Math.max(1, Math.min(dayCount, Number(value)))));
  const stop = (e) => e.stopPropagation();

  return (
    <div className="day-slider" onPointerDown={stop} onKeyDown={stop}>
      <button type="button" className="day-slider__step" onClick={() => set(day - 1)} disabled={day <= 1} title="Previous day">◀</button>
      <input
        type="range"
        min={1}
        max={dayCount}
        step={1}
        value={day}
        onChange={(e) => set(e.target.value)}
        aria-label="Selected day"
      />
      <button type="button" className="day-slider__step" onClick={() => set(day + 1)} disabled={day >= dayCount} title="Next day">▶</button>
      <span className="day-slider__label">Day {day} / {dayCount}</span>
    </div>
  );
}
