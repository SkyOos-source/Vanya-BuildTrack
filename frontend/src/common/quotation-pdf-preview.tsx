import { useEffect, useState } from "react";

export function QuotationPdfPreview({ attachment, title }: { attachment: string; title: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button className="text-link quotation-pdf-button" type="button" onClick={() => setOpen(true)}>View PDF ↗</button>
    {open && <div className="pdf-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="pdf-preview-dialog" role="dialog" aria-modal="true" aria-label={`${title} PDF preview`}>
        <header className="pdf-preview-header">
          <strong>{title}</strong>
          <div>
            <a className="button button-outline" href={attachment} download={`${title}.pdf`}>Download</a>
            <button className="icon-button" type="button" aria-label="Close PDF preview" onClick={() => setOpen(false)}>×</button>
          </div>
        </header>
        <iframe title={`${title} PDF`} src={attachment} />
      </section>
    </div>}
  </>;
}
