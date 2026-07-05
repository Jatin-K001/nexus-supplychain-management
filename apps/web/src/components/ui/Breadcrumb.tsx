import { Fragment, ReactNode } from 'react';

export function Breadcrumb({ parts }: { parts: ReactNode[] }) {
  return (
    <div className="breadcrumb">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span> / </span>}
          {p}
        </Fragment>
      ))}
    </div>
  );
}
