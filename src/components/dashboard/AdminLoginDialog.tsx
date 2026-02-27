import { useState } from "react";
import { Lock, LockOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AdminLoginDialogProps {
  isAdmin: boolean;
  onLogin: (password: string) => boolean;
  onLogout: () => void;
}

export function AdminLoginDialog({ isAdmin, onLogin, onLogout }: AdminLoginDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (onLogin(password)) {
      toast.success("관리자 모드가 활성화되었습니다.");
      setPassword("");
      setIsOpen(false);
    } else {
      toast.error("비밀번호가 올바르지 않습니다.");
      setPassword("");
    }
  };

  const handleLogout = () => {
    onLogout();
    toast.info("관리자 모드가 해제되었습니다.");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setPassword(""); }}>
      <DialogTrigger asChild>
        <Button
          variant={isAdmin ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          {isAdmin ? (
            <>
              <LockOpen className="h-4 w-4" />
              관리자
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              관리자
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <LockOpen className="h-5 w-5 text-primary" />
                관리자 모드
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                관리자 로그인
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "관리자 모드가 활성화된 상태입니다."
              : "관리자 비밀번호를 입력하세요."}
          </DialogDescription>
        </DialogHeader>

        {isAdmin ? (
          <div className="space-y-4">
            <div className="bg-primary/10 rounded-lg p-3 text-sm text-primary">
              관리자 권한: 데이터 편집, 이메일 발송, 클라우드 저장
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              관리자 모드 해제
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">비밀번호</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleLogin}
              disabled={!password}
            >
              <Lock className="h-4 w-4" />
              로그인
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
