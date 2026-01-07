import React, { ReactNode } from "react";
import s from "./Footer.module.css";

export const FooterWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <footer className={`${s.Footer} py-3 px-6`}>
      <div className="relative w-full max-w-(--page-max-width) m-auto">
        {children}
      </div>
    </footer>
  );
};

export const Footer = () => null;
