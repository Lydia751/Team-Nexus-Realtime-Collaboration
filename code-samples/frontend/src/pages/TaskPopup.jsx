import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import TaskBoard from './TaskBoard';
import './TaskPopup.css';

export default function TaskPopup({ taskId, user, onClose }) {
  const popupRef = useRef();
  const headerRef = useRef();
  // DEFAULT SIZE
  const DEFAULT_WIDTH  = 600;
  const DEFAULT_HEIGHT = 400;
  const [size, setSize] = useState({
    width:  DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

  const [position, setPosition] = useState({ x: 100, y: 100 });
  //const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (popupRef.current) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      setPosition({
        x: Math.max(0, (viewportWidth - size.width) / 2),
        y: Math.max(0, (viewportHeight - size.height) / 2),
      });
    }
  }, [size.width, size.height]);

  // Dragging
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let startX, startY, startPos;

    const onMouseDown = (e) => {
      startX = e.clientX;
      startY = e.clientY;
      startPos = { ...position };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      setPosition({
        x: startPos.x + e.clientX - startX,
        y: startPos.y + e.clientY - startY
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);
    return () => header.removeEventListener('mousedown', onMouseDown);
  }, [position]);

  // Resizing
  const handleResize = (e) => {
    e.preventDefault();
    const startWidth = size.width;
    const startHeight = size.height;
    const startX = e.clientX;
    const startY = e.clientY;

    const doResize = (event) => {
      setSize({
        width: Math.max(400, startWidth + event.clientX - startX),
        height: Math.max(300, startHeight + event.clientY - startY)
      });
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

    // Build the popup’s DOM tree
    const popupElement = (
      <div
        ref={popupRef}
        className="task-popup"
        style={{
          position: 'fixed',
          top:      `${position.y}px`,
          left:     `${position.x}px`,
          width:    `${size.width}px`,
          height:   `${size.height}px`,
          zIndex:    9999,
        }}
      >
        <div ref={headerRef} className="task-popup-header">
          <span>Task Details</span>
          <button className="task-popup-close" onClick={onClose}>✖</button>
        </div>
  
        <div className="task-popup-body">
          <TaskBoard user={user} taskId={taskId} />
        </div>
  
        <div className="resize-handle" onMouseDown={handleResize} />
      </div>
    );

     // PORTAL: render the popup into document.body so it sits above all stacking contexts
  return ReactDOM.createPortal(
    popupElement,
    document.body
  );

  
}
