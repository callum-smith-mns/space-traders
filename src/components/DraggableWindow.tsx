import { useState, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import './DraggableWindow.css';

export interface WindowLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DraggableWindowProps {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultX?: number;
  defaultY?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  onFocus?: () => void;
  onLayoutChange?: (layout: WindowLayout) => void;
  zIndex?: number;
}

export default function DraggableWindow({
  title,
  icon,
  children,
  defaultX = 100,
  defaultY = 100,
  defaultWidth = 420,
  defaultHeight = 500,
  minWidth = 300,
  minHeight = 200,
  onFocus,
  onLayoutChange,
  zIndex = 10,
}: DraggableWindowProps) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [minimized, setMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleDragStart = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onFocus?.();
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      let lastPos = { x: pos.x, y: pos.y };

      const onMove = (ev: globalThis.MouseEvent) => {
        lastPos = {
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        };
        setPos(lastPos);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        onLayoutChange?.({ ...lastPos, w: size.w, h: size.h });
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [pos, size, onFocus, onLayoutChange]
  );

  const handleResizeStart = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus?.();
      resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
      let lastSize = { w: size.w, h: size.h };

      const onMove = (ev: globalThis.MouseEvent) => {
        lastSize = {
          w: Math.max(minWidth, resizeStart.current.w + ev.clientX - resizeStart.current.x),
          h: Math.max(minHeight, resizeStart.current.h + ev.clientY - resizeStart.current.y),
        };
        setSize(lastSize);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        onLayoutChange?.({ x: pos.x, y: pos.y, ...lastSize });
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [size, pos, minWidth, minHeight, onFocus, onLayoutChange]
  );

  return (
    <div
      className={`dw ${minimized ? 'dw--minimized' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: minimized ? 'auto' : size.h,
        zIndex,
      }}
      onMouseDown={onFocus}
    >
      {/* Title bar */}
      <div className="dw-bar" onMouseDown={handleDragStart}>
        <div className="dw-bar-left">
          {icon && <img src={icon} alt="" className="dw-icon" />}
          <span className="dw-title">{title}</span>
        </div>
        <div className="dw-bar-actions">
          <button
            className="dw-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((m) => !m);
            }}
            title={minimized ? 'Restore' : 'Minimize'}
          >
            {minimized ? '◻' : '—'}
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="dw-body">
          {children}
        </div>
      )}

      {/* Resize handle */}
      {!minimized && (
        <div className="dw-resize" onMouseDown={handleResizeStart} />
      )}
    </div>
  );
}
