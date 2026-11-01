import React from 'react';

interface TecavyPageHeadProps {
  label: string;
  title: string;
  description?: string;
  tools?: React.ReactNode;
}

export default function TecavyPageHead({ label, title, description, tools }: TecavyPageHeadProps) {
  return (
    <div className="tx-pagehead">
      <div>
        <div className="tx-eyebrow">{label}</div>
        <h1>{title}</h1>
        {description ? <p className="tx-sub">{description}</p> : null}
      </div>
      {tools ? <div className="tx-headtools">{tools}</div> : null}
    </div>
  );
}
