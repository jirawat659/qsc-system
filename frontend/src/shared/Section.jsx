import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { c, sans, mono, cardStyle } from "../config/theme";
import { TopBarContext } from "../context/TopBarContext";
import { DataContext } from "../context/DataContext";

export default function Section({ title, children, action }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[13.5px] font-bold" style={{ color: c.ink }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
