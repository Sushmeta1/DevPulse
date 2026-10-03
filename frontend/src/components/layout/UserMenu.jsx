import { Menu } from '@base-ui/react/menu';
import { Check, ExternalLink, LogOut } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { useAuth } from '../../state/auth.jsx';
import { useTheme } from '../../lib/theme.js';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { preference, setTheme } = useTheme();
  const label = user.name || user.login;

  return (
    <Menu.Root>
      <Menu.Trigger className="press rounded-full outline-offset-2" aria-label="Account menu">
        <Avatar login={user.isDemo ? null : user.login} name={label} src={user.avatarUrl} size={28} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Menu.Popup className="popup min-w-56 p-1">
            <div className="px-2.5 py-2">
              <p className="truncate text-[13px] font-medium">{label}</p>
              <p className="truncate text-xs text-fg-muted">{user.isDemo ? 'Demo workspace' : `@${user.login}`}</p>
            </div>
            <div className="menu-sep" />
            <Menu.Group>
              <Menu.GroupLabel className="menu-label">Theme</Menu.GroupLabel>
              <Menu.RadioGroup value={preference} onValueChange={setTheme}>
                {[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => (
                  <Menu.RadioItem key={v} value={v} className="menu-item">
                    {l}
                    <Menu.RadioItemIndicator className="ml-auto"><Check size={14} className="text-accent" aria-hidden="true" /></Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <div className="menu-sep" />
            {!user.isDemo && (
              <Menu.LinkItem className="menu-item" href={`https://github.com/${user.login}`} target="_blank" rel="noreferrer">
                Your GitHub profile <ExternalLink size={13} className="ml-auto text-fg-faint" aria-hidden="true" />
              </Menu.LinkItem>
            )}
            <Menu.Item className="menu-item" onClick={signOut}>
              <LogOut size={14} aria-hidden="true" /> {user.isDemo ? 'Exit demo' : 'Sign out'}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
