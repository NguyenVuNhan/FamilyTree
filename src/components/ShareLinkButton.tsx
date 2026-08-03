import { useState } from 'react';
import { LinkIcon } from './icons';

export function ShareLinkButton({ link }: { link: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('copied');
    } catch {
      setStatus('manual'); // clipboard unavailable or denied — show the link for manual copy
    }
  };

  return (
    <span className="share-link">
      <button type="button" aria-label="Copy share link" onClick={copy}><LinkIcon /></button>
      <span aria-live="polite" data-testid="copy-confirmation">{status === 'copied' ? 'Link copied' : ''}</span>
      {status === 'manual' && (
        <input readOnly aria-label="Share link" value={link} onFocus={(e) => e.currentTarget.select()} />
      )}
    </span>
  );
}
