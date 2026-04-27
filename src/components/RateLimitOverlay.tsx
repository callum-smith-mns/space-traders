import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import './RateLimitOverlay.css';

/** Only show the overlay if the rate-limit wait exceeds this threshold. */
const DISPLAY_THRESHOLD_MS = 3000;

export default function RateLimitOverlay() {
  const [resetAt, setResetAt] = useState<number | null>(api.rateLimitResetAt);
  const [countdown, setCountdown] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return api.onRateLimitChange((nextResetAt) => {
      setResetAt(nextResetAt);
      if (nextResetAt && nextResetAt - Date.now() > DISPLAY_THRESHOLD_MS) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    });
  }, []);

  const tick = useCallback(() => {
    if (!resetAt) { setCountdown(0); return; }
    const remaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    setCountdown(remaining);
    if (remaining <= 0) { setResetAt(null); setVisible(false); }
  }, [resetAt]);

  useEffect(() => {
    if (!resetAt) { setCountdown(0); return; }
    tick();
    timerRef.current = setInterval(tick, 250);
    return () => clearInterval(timerRef.current);
  }, [resetAt, tick]);

  if (!visible || !resetAt || countdown <= 0) return null;

  return (
    <div className="ratelimit-overlay">
      <div className="ratelimit-card">
        <div className="ratelimit-icon">⏳</div>
        <div className="ratelimit-title">Rate Limit Reached</div>
        <div className="ratelimit-desc">
          The SpaceTraders API rate limit has been hit.
          <br />
          Requests will resume automatically.
        </div>
        <div className="ratelimit-countdown">{countdown}s</div>
        <div className="ratelimit-bar-track">
          <div
            className="ratelimit-bar-fill"
            style={{ animationDuration: `${countdown}s` }}
          />
        </div>
      </div>
    </div>
  );
}
