// src/components/TemporalControls/TimelineSlider.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Slider, Typography } from '@material-ui/core';
import { setCurrentTime } from '../../store/slices/timeSlice';
import { formatDate } from '../../utils/dateFormatters';

const TimelineSlider = () => {
  const dispatch = useDispatch();
  const { current, min, max } = useSelector(state => state.time);
  
  const handleChange = (event, newValue) => {
    dispatch(setCurrentTime(newValue));
  };
  
  return (
    <div className="timeline-slider">
      <Typography variant="body2">{formatDate(min)}</Typography>
      <Slider
        value={current}
        min={min}
        max={max}
        onChange={handleChange}
        valueLabelDisplay="auto"
        valueLabelFormat={formatDate}
      />
      <Typography variant="body2">{formatDate(max)}</Typography>
    </div>
  );
};

export default TimelineSlider;