import React from 'react';

export const GarmentIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg
      viewBox="0 0 800 580"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Soft Organic Gradients */}
        <linearGradient id="machineGrad" x1="150" y1="180" x2="550" y2="460" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A3C2F7" />
          <stop offset="100%" stopColor="#7E9FE0" />
        </linearGradient>

        <linearGradient id="fabricGrad" x1="330" y1="380" x2="560" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EBF5F3" />
        </linearGradient>

        <linearGradient id="pastelGreenGrad" x1="120" y1="100" x2="620" y2="520" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D8EFC4" />
          <stop offset="60%" stopColor="#CFE9B8" />
          <stop offset="100%" stopColor="#C4E4AB" />
        </linearGradient>

        <pattern id="meshGrid" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#8FC4D1" strokeWidth="0.85" strokeOpacity="0.45" />
        </pattern>
      </defs>

      {/* ============================================================ */}
      {/* 1. SEAMLESS BACKGROUND ORGANIC PASTEL BLOBS & BUBBLES (ADJUSTED & SCALED) */}
      {/* ============================================================ */}
      
      {/* Authentic Pastel Green Organic Backdrop Shape (Smooth contoured shape behind team & machine) */}
      <path
        d="M 360 70 C 440 60 490 110 520 180 C 560 250 660 310 675 395 C 690 470 600 525 500 535 C 390 545 250 550 160 505 C 80 465 55 375 68 285 C 80 195 135 125 225 100 C 285 85 320 75 360 70 Z"
        fill="url(#pastelGreenGrad)"
        fillOpacity="0.9"
      />

      {/* Supporting Pastel Yellow & Light Blue Secondary Blobs */}
      <path
        d="M 190 85 C 240 70 280 110 270 160 C 260 200 210 215 165 200 C 125 185 110 140 135 105 C 155 80 170 90 190 85 Z"
        fill="#FBF3D5"
        fillOpacity="0.6"
      />

      {/* Scaled Atmospheric Pastel Bubbles (Top-Left Cluster) */}
      <circle cx="110" cy="130" r="46" fill="#B8D8EE" fillOpacity="0.65" />
      <circle cx="225" cy="80" r="58" fill="#8FC4D1" fillOpacity="0.45" />
      <circle cx="185" cy="180" r="28" fill="#B8D8EE" fillOpacity="0.6" />
      <circle cx="55" cy="225" r="20" fill="#8FC4D1" fillOpacity="0.4" />
      <circle cx="280" cy="55" r="16" fill="#F5C542" fillOpacity="0.45" />

      {/* Floating Bubbles near Center-Right and Bottom */}
      <circle cx="430" cy="545" r="26" fill="#8FC4D1" fillOpacity="0.55" />
      <circle cx="515" cy="555" r="18" fill="#B8D8EE" fillOpacity="0.65" />
      <circle cx="650" cy="470" r="36" fill="#CFE9B8" fillOpacity="0.8" />
      <circle cx="690" cy="380" r="22" fill="#B8D8EE" fillOpacity="0.5" />
      <circle cx="590" cy="180" r="14" fill="#F5C542" fillOpacity="0.4" />

      {/* Subtle Mesh Textile Fabric Texture on Bottom-Left */}
      <g transform="translate(90, 410) rotate(-14)">
        <polygon points="0,45 160,0 195,100 25,135" fill="url(#meshGrid)" />
      </g>

      {/* ============================================================ */}
      {/* 2. INDUSTRIAL SEWING MACHINE BODY (PERIWINKLE FLAT VECTOR) */}
      {/* ============================================================ */}
      <g id="sewingMachineGroup">
        {/* Rear Wheel / Arm Details */}
        <rect x="155" y="250" width="24" height="75" rx="10" fill="#1E3A5F" />
        <rect x="170" y="235" width="30" height="105" rx="8" fill="#2A4B75" />

        {/* Base Table Bed */}
        <path
          d="M 170 415 C 170 398, 185 398, 198 398 L 525 398 C 540 398, 550 408, 550 425 L 550 448 C 550 458, 540 464, 525 464 L 198 464 C 182 464, 170 455, 170 442 Z"
          fill="url(#machineGrad)"
        />

        {/* Vertical Column and Horizontal Top Arm (Smooth industrial shape) */}
        <path
          d="M 185 230 C 185 208, 208 198, 235 198 L 475 198 C 510 198, 530 220, 530 258 L 530 348 C 530 365, 515 375, 498 375 L 445 375 C 428 375, 418 365, 418 348 L 418 295 C 418 275, 402 258, 380 258 L 310 258 C 288 258, 272 275, 272 295 L 272 398 L 185 398 Z"
          fill="url(#machineGrad)"
        />

        {/* Needle Housing Bar Extension */}
        <rect x="472" y="342" width="20" height="44" rx="3" fill="#D3E2FA" />
        <rect x="480" y="386" width="4.5" height="28" fill="#2C3E50" />
        {/* Needle Tip & Foot */}
        <polygon points="477,410 487,410 482,418" fill="#1A252F" />

        {/* Machine Accents & Controls */}
        <rect x="448" y="292" width="18" height="12" rx="3" fill="#F5C542" />
        <circle cx="488" cy="298" r="7" fill="#1E3A5F" />
        <circle cx="510" cy="298" r="7" fill="#F5C542" />

        {/* Top Dark Saddle / Platform for kneeling worker */}
        <path d="M 245 198 L 355 198 C 360 198, 365 204, 363 210 L 354 230 C 352 235, 345 237, 340 237 L 235 237 C 230 237, 226 230, 230 225 Z" fill="#1E3A5F" />

        {/* Big Yellow Spool of Thread on Top-Left Spindle */}
        <g transform="translate(198, 142)">
          <rect x="25" y="-14" width="7" height="76" rx="3" fill="#D3E2FA" />
          <rect x="11" y="0" width="35" height="7" rx="2" fill="#E5B22E" />
          <rect x="15" y="7" width="27" height="48" fill="#F5C542" />
          {/* Thread criss-cross lines */}
          <line x1="15" y1="13" x2="42" y2="30" stroke="#FFFFFF" strokeWidth="1.8" strokeOpacity="0.85" />
          <line x1="42" y1="13" x2="15" y2="30" stroke="#FFFFFF" strokeWidth="1.8" strokeOpacity="0.85" />
          <line x1="15" y1="28" x2="42" y2="45" stroke="#FFFFFF" strokeWidth="1.8" strokeOpacity="0.85" />
          <line x1="42" y1="28" x2="15" y2="45" stroke="#FFFFFF" strokeWidth="1.8" strokeOpacity="0.85" />
          <rect x="11" y="55" width="35" height="7" rx="2" fill="#E5B22E" />
        </g>
      </g>

      {/* ============================================================ */}
      {/* 3. COLLABORATIVE GARMENT TEAM (FLAT VECTOR CHARACTERS) */}
      {/* ============================================================ */}

      {/* WORKER 1: TOP KNEELING WORKER (Blue Shirt, Navy Pants) */}
      <g id="workerTop" transform="translate(290, 88)">
        {/* Head */}
        <circle cx="52" cy="24" r="11" fill="#FCD3B0" />
        {/* Hair */}
        <path d="M 43 22 C 43 13, 61 11, 63 20 C 63 22, 58 24, 54 24 Z" fill="#F5C542" />
        {/* Torso */}
        <path d="M 43 35 L 65 35 C 69 35, 71 42, 69 48 L 60 76 L 38 76 L 36 48 C 36 39, 38 35, 43 35 Z" fill="#5D9CEC" />
        {/* Arms pulling thread */}
        <path d="M 43 42 L 78 57 L 95 62" stroke="#FCD3B0" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Kneeling Legs */}
        <path d="M 43 74 L 32 96 C 30 100, 24 100, 19 98 L 0 98" stroke="#1E3A5F" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 56 74 L 76 96 L 82 115" stroke="#1E3A5F" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        {/* Shoe */}
        <ellipse cx="85" cy="115" rx="8" ry="4.5" fill="#0D1E33" />
        {/* Thread from spool in hand */}
        <path d="M -65 55 Q 95 62 195 320" stroke="#FFFFFF" strokeWidth="2.2" fill="none" strokeDasharray="3.5 1.5" />
      </g>

      {/* WORKER 2: LEFT WORKER HOLDING THREAD (Dark Tank Top, Blue Pants, Yellow Hair) */}
      <g id="workerLeft" transform="translate(125, 245)">
        {/* Head */}
        <circle cx="39" cy="20" r="10" fill="#FCD3B0" />
        {/* Hair Bun/Flowing Yellow Hair */}
        <path d="M 30 15 C 30 5, 50 6, 48 20 C 46 24, 37 28, 28 24 C 22 21, 26 15, 30 15 Z" fill="#F5C542" />
        {/* Upper Body (Dark Navy Tank) */}
        <path d="M 32 30 L 50 30 L 54 68 L 28 68 Z" fill="#1E3A5F" />
        {/* Arms holding spool */}
        <path d="M 32 37 L 54 52 L 74 41" stroke="#FCD3B0" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 48 37 L 68 48 L 83 37" stroke="#FCD3B0" strokeWidth="5.5" strokeLinecap="round" />
        {/* Held White Thread Bobbin */}
        <g transform="translate(74, 28) rotate(20)">
          <rect x="-7" y="-15" width="14" height="30" rx="3.5" fill="#FFFFFF" stroke="#8FC4D1" strokeWidth="1.6" />
          <line x1="-6" y1="-9" x2="6" y2="-9" stroke="#8FC4D1" strokeWidth="1.2" />
          <line x1="-6" y1="-2" x2="6" y2="-2" stroke="#8FC4D1" strokeWidth="1.2" />
          <line x1="-6" y1="5" x2="6" y2="5" stroke="#8FC4D1" strokeWidth="1.2" />
        </g>
        {/* Stepping Light Blue Pants */}
        <path d="M 32 68 L 30 108 L 0 116" stroke="#8CB6F0" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 50 68 L 59 103 L 61 134" stroke="#8CB6F0" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        {/* Shoes */}
        <ellipse cx="-2" cy="117" rx="7" ry="3.5" fill="#1E3A5F" />
        <ellipse cx="63" cy="135" rx="7" ry="3.5" fill="#1E3A5F" />
      </g>

      {/* WHITE FLOWING CLOTH / FABRIC SHEET UNDER NEEDLE */}
      <g id="flowingFabric">
        {/* 3D Folded Curving White Fabric */}
        <path
          d="M 480 410 C 460 420, 415 435, 355 462 C 305 485, 328 518, 395 508 C 472 496, 560 420, 570 398 C 576 388, 548 388, 515 398 Z"
          fill="url(#fabricGrad)"
          stroke="#D8E8E6"
          strokeWidth="1.6"
        />
        {/* Fold highlight line */}
        <path
          d="M 355 462 C 395 445, 515 398, 570 398"
          stroke="#C5DED9"
          strokeWidth="2.2"
          fill="none"
        />
      </g>

      {/* WORKER 3: CENTER WORKER GUIDING CLOTH (Yellow Shirt, Navy Pants) */}
      <g id="workerCenter" transform="translate(290, 295)">
        {/* Head */}
        <circle cx="33" cy="20" r="10" fill="#FCD3B0" />
        {/* Hair */}
        <path d="M 24 18 C 24 11, 42 9, 42 20 Z" fill="#1E3A5F" />
        {/* Yellow Top */}
        <path d="M 24 30 C 24 30, 33 28, 42 30 C 46 31, 48 49, 52 64 L 20 64 C 22 49, 22 31, 24 30 Z" fill="#F5C542" />
        {/* Arms outstretched guiding cloth */}
        <path d="M 33 37 L 59 55 L 83 61" stroke="#FCD3B0" strokeWidth="6" strokeLinecap="round" />
        <path d="M 26 37 L 44 52 L 68 64" stroke="#FCD3B0" strokeWidth="6" strokeLinecap="round" />
        {/* Pants */}
        <path d="M 26 64 L 24 120 L 17 150" stroke="#1E3A5F" strokeWidth="9.5" strokeLinecap="round" />
        <path d="M 44 64 L 48 120 L 53 150" stroke="#1E3A5F" strokeWidth="9.5" strokeLinecap="round" />
        {/* Shoes */}
        <ellipse cx="15" cy="151" rx="7" ry="3.5" fill="#0D1E33" />
        <ellipse cx="55" cy="151" rx="7" ry="3.5" fill="#0D1E33" />
      </g>

      {/* WORKER 4: RIGHT WORKER HOLDING FABRIC END (Yellow Dress/Shirt, Hair Bun) */}
      <g id="workerRight" transform="translate(460, 300)">
        {/* Head */}
        <circle cx="30" cy="20" r="9.5" fill="#FCD3B0" />
        {/* Hair Bun */}
        <circle cx="37" cy="13" r="5.5" fill="#1E3A5F" />
        <path d="M 22 18 C 22 11, 40 11, 40 20 Z" fill="#1E3A5F" />
        {/* Yellow Dress */}
        <path d="M 24 30 L 37 30 L 46 76 L 18 76 Z" fill="#F5C542" />
        {/* Arms holding fabric corner */}
        <path d="M 26 35 L 9 50 L -11 55" stroke="#FCD3B0" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 35 35 L 15 48 L 0 59" stroke="#FCD3B0" strokeWidth="5.5" strokeLinecap="round" />
        {/* Blue/Navy Leggings */}
        <path d="M 24 76 L 24 142" stroke="#1E3A5F" strokeWidth="7.5" strokeLinecap="round" />
        <path d="M 37 76 L 39 142" stroke="#1E3A5F" strokeWidth="7.5" strokeLinecap="round" />
        {/* Shoes */}
        <ellipse cx="22" cy="142" rx="6" ry="3" fill="#0D1E33" />
        <ellipse cx="41" cy="142" rx="6" ry="3" fill="#0D1E33" />
      </g>

      {/* ============================================================ */}
      {/* 4. SEWING ACCESSORIES: MEASURING TAPE & SCISSORS */}
      {/* ============================================================ */}

      {/* Yellow Measuring Tape Roll (Bottom Left) */}
      <g id="measuringTape" transform="translate(135, 435)">
        {/* Tape Tail Ribbon extending left */}
        <path d="M 13 38 C 0 38, -22 22, -30 30" stroke="#F5C542" strokeWidth="13" strokeLinecap="round" fill="none" />
        {/* Black tick marks on ribbon */}
        <line x1="-16" y1="24" x2="-16" y2="30" stroke="#1E3A5F" strokeWidth="1.6" />
        <line x1="-9" y1="27" x2="-9" y2="33" stroke="#1E3A5F" strokeWidth="1.6" />
        <line x1="-1" y1="32" x2="-1" y2="38" stroke="#1E3A5F" strokeWidth="1.6" />

        {/* Circular Roll */}
        <circle cx="30" cy="30" r="24" fill="#E5B22E" />
        <circle cx="30" cy="30" r="20" fill="#F5C542" />
        <circle cx="30" cy="30" r="14" fill="#E5B22E" />
        <circle cx="30" cy="30" r="10" fill="#F5C542" />
        <circle cx="30" cy="30" r="5.5" fill="#1E3A5F" />
      </g>

      {/* Blue & Yellow Sewing Scissors */}
      <g id="scissors" transform="translate(195, 475) rotate(15)">
        {/* Blade 1 */}
        <path d="M 16 16 L 82 -5 C 85 -6, 88 -3, 83 0 L 24 24 Z" fill="#1769AA" />
        {/* Blade 2 */}
        <path d="M 16 24 L 79 30 C 83 31, 83 27, 78 24 L 20 13 Z" fill="#2080C8" />
        {/* Central Pivot Screw */}
        <circle cx="28" cy="18" r="3.5" fill="#D3E2FA" />
        {/* Yellow Handles */}
        <ellipse cx="5" cy="9" rx="15" ry="10" fill="none" stroke="#F5C542" strokeWidth="6.5" />
        <ellipse cx="9" cy="33" rx="17" ry="11" fill="none" stroke="#F5C542" strokeWidth="6.5" />
      </g>

    </svg>
  );
};
