import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './Sidebar.css';
import { toggleL1Filter } from '../../store/slices/mapSlice';

const Sidebar = () => {
  const dispatch = useDispatch();
  const activeFilters = useSelector(state => state.map.activeL1Filters);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleFilterToggle = (label) => {
    dispatch(toggleL1Filter(label));
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        {isCollapsed ? '>' : '<'}
      </button>
      {!isCollapsed && (
        <div className="sidebar-content">
          <h3>Filter by L1 Label</h3>
          <div className="filter-controls">
            {['Forest', 'Water', 'Developed', 'Arable', 'Other'].map((label) => (
              <div key={label} className="filter-control">
                <input
                  type="checkbox"
                  id={`filter-${label}`}
                  checked={activeFilters.includes(label)}
                  onChange={() => handleFilterToggle(label)}
                />
                <label htmlFor={`filter-${label}`}>{label}</label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;