import { useEffect } from 'react';

/**
 * Injects a JSON-LD structured-data <script> into <head> and removes it on
 * unmount so it never lingers onto the next page. Renders nothing visible.
 */
export default function JsonLd({ id, data }) {
  const json = data ? JSON.stringify(data) : null;
  useEffect(() => {
    if (!json) return undefined;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = json;
    return () => el.remove();
  }, [id, json]);
  return null;
}
