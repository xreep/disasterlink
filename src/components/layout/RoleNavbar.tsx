import { Link } from "wouter";
import { Activity, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoleNavbarProps {
  role: "Affected" | "Volunteer" | "Coordinator";
}

export function RoleNavbar({ role }: RoleNavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl leading-none">DisasterLink</h1>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{role} Portal</span>
          </div>
        </div>
        
        <nav>
          <Link href="/" className="inline-block">
            <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Switch Role</span>
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
