import { Outlet } from "react-router-dom";

export function WaiterAuthLayout() {
  return (
    <div className="dark mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-background text-foreground">
      <Outlet />
    </div>
  );
}
