import { useEffect, useRef, ReactNode } from "react";

interface AuthBackgroundProps {
  children: ReactNode;
}

const AuthBackground = ({ children }: AuthBackgroundProps) => {
  const bokehRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
@keyframes bokehFloat {
  0% { transform: translateY(100vh) scale(0); opacity: 0; }
  10% { opacity: var(--bokeh-opacity); }
  90% { opacity: var(--bokeh-opacity); }
  100% { transform: translateY(-20vh) scale(1.2); opacity: 0; }
}
@keyframes splashIn {
  0% { opacity: 0; transform: scale(0.8) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes pulseGlow {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
}
`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const container = bokehRef.current;
    if (!container) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const colors = [
      "hsla(24,100%,50%,OPACITY)",
      "hsla(30,100%,60%,OPACITY)",
      "hsla(15,80%,45%,OPACITY)",
      "hsla(35,100%,70%,OPACITY)",
      "hsla(0,0%,100%,OPACITY)",
    ];

    const createParticle = () => {
      if (!container) return;
      const particle = document.createElement("div");
      const size = Math.random() * 6 + 2;
      const opacity = Math.random() * 0.25 + 0.05;
      const colorTemplate = colors[Math.floor(Math.random() * colors.length)];
      const color = colorTemplate.replace("OPACITY", String(opacity));
      const duration = Math.random() * 15 + 12;
      const delay = Math.random() * 8;
      const left = Math.random() * 100;

      particle.style.position = "absolute";
      particle.style.borderRadius = "50%";
      particle.style.filter = "blur(1px)";
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.background = color;
      particle.style.left = `${left}%`;
      particle.style.bottom = "0";
      particle.style.boxShadow = `0 0 ${size * 3}px ${color}`;
      particle.style.setProperty("--bokeh-opacity", String(opacity));
      particle.style.animation = `bokehFloat ${duration}s linear infinite`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.pointerEvents = "none";

      container.appendChild(particle);

      const timeoutId = setTimeout(() => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
        createParticle();
      }, (duration + delay) * 1000);
      timeouts.push(timeoutId);
    };

    for (let i = 0; i < 25; i++) {
      createParticle();
    }

    return () => {
      timeouts.forEach((id) => clearTimeout(id));
      if (container) container.innerHTML = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Fixed background - bleeds into safe areas */}
      <div
        className="fixed pointer-events-none z-0"
        style={{
          top: "calc(-1 * env(safe-area-inset-top, 0px))",
          left: 0,
          right: 0,
          bottom: "calc(-1 * env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Layer 1: Gradients */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% 0%, hsla(24,90%,18%,0.9), transparent 60%),
              radial-gradient(ellipse 100% 80% at 50% 100%, hsla(24,80%,12%,0.8), transparent 70%),
              radial-gradient(ellipse 60% 50% at 0% 50%, hsla(24,60%,6%,0.6), transparent 60%),
              linear-gradient(180deg, #0a0806 0%, #1a0e04 50%, #0a0806 100%)
            `,
          }}
        />

        {/* Layer 2: Noise */}
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Layer 3: Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Layer 4: Bokeh particles */}
        <div ref={bokehRef} className="absolute inset-0 overflow-hidden" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export default AuthBackground;