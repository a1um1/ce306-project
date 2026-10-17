import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import styles from "./Navbar.module.css";

type Props = {
  user: { name: string; email: string; image?: string | null };
  onManageCategories: () => void;
};

export function Navbar({ user, onManageCategories }: Props) {
  const navigate = useNavigate();

  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/signin" });
  };

  return (
    <header className={styles.navbar}>
      <Link
        to="/"
        search={{
          range: "today",
          year: new Date().getFullYear(),
        }}
        className={styles.logoLong}
      >
        <span className={styles.logoMark}>
          <img
            src="/assets/logo-slip.svg"
            alt=""
            width={34}
            height={34}
            className={styles.logoImg}
          />
        </span>
        <span className={styles.logoText}>PayTail</span>
      </Link>

      <Menu.Root>
        <Menu.Trigger className={styles.user}>
          <span className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</span>
          <span className={styles.userName}>{user.name}</span>
          <ChevronDown size={20} strokeWidth={3} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={8}>
            <Menu.Popup className={styles.menu}>
              <Menu.Item className={styles.menuItem} onClick={onManageCategories}>
                จัดการหมวดหมู่
              </Menu.Item>
              <Menu.Separator className={styles.separator} />
              <Menu.Item className={styles.menuItem} onClick={signOut}>
                ออกจากระบบ
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </header>
  );
}
