import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';
    const variants = {
      primary:   'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm',
      secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300',
      ghost:     'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
      danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
      outline:   'border border-zinc-200 text-zinc-700 hover:bg-zinc-50',
    };
    const sizes = {
      sm:   'h-7 px-3 text-xs',
      md:   'h-9 px-4 text-sm',
      lg:   'h-11 px-6 text-base',
      icon: 'h-8 w-8 p-0',
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'indigo' | 'green' | 'yellow' | 'red' | 'zinc' | 'blue' | 'purple';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => {
  const variants = {
    default: 'bg-zinc-100 text-zinc-700',
    indigo:  'bg-indigo-100 text-indigo-700',
    green:   'bg-green-100 text-green-700',
    yellow:  'bg-yellow-100 text-yellow-700',
    red:     'bg-red-100 text-red-700',
    zinc:    'bg-zinc-200 text-zinc-600',
    blue:    'bg-blue-100 text-blue-700',
    purple:  'bg-purple-100 text-purple-700',
  };
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', variants[variant], className)}
      {...props}
    />
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

// ─── Textarea ─────────────────────────────────────────────────────────────────

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 resize-none',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'disabled:opacity-50 transition-colors',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

// ─── Label ────────────────────────────────────────────────────────────────────

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
  <label className={cn('text-sm font-medium text-zinc-700', className)} {...props} />
);

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; }
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  onChange?: (value: string) => void;
}

export const Select: React.FC<SelectProps> = ({ className, options, onChange, ...props }) => (
  <select
    className={cn(
      'w-full h-9 px-3 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900',
      'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
      'disabled:opacity-50 cursor-pointer transition-colors appearance-none',
      className,
    )}
    onChange={(e) => onChange?.(e.target.value)}
    {...props}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

// ─── Card ─────────────────────────────────────────────────────────────────────

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={cn(
      'rounded-xl bg-white border border-zinc-200/80 shadow-sm',
      className,
    )}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-between p-4 border-b border-zinc-100', className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('p-4', className)} {...props} />
);

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  initials: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ initials, color = '#6366f1', size = 'sm', className, title }) => {
  const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-11 w-11 text-base' };
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0', sizes[size], className)}
      style={{ backgroundColor: color }}
      title={title}
    >
      {initials}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('animate-pulse rounded-lg bg-zinc-200', className)} {...props} />
);

// ─── Separator ────────────────────────────────────────────────────────────────

export const Separator: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('h-px bg-zinc-100', className)} />
);

// ─── Switch ───────────────────────────────────────────────────────────────────

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, id }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none" htmlFor={id}>
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        checked ? 'bg-indigo-600' : 'bg-zinc-300',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-1',
        )}
      />
    </button>
    {label && <span className="text-sm text-zinc-700">{label}</span>}
  </label>
);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, className }) => (
  <div className={cn('flex items-center gap-1 border-b border-zinc-200', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors',
          active === tab.id
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-zinc-500 hover:text-zinc-800',
        )}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
);

// ─── Dialog (Radix-based) ─────────────────────────────────────────────────────

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent: React.FC<DialogPrimitive.DialogContentProps & { wide?: boolean }> = ({
  children, className, wide, ...props
}) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      className={cn(
        'fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'bg-white rounded-2xl shadow-2xl border border-zinc-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2',
        wide ? 'w-full max-w-2xl' : 'w-full max-w-md',
        'max-h-[90vh] overflow-y-auto p-6',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-4 right-4 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
        <X size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('mb-5', className)} {...props} />
);

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// ─── Dropdown ─────────────────────────────────────────────────────────────────

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export const DropdownContent: React.FC<DropdownPrimitive.DropdownMenuContentProps> = ({
  className, ...props
}) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      className={cn(
        'z-50 min-w-[160px] rounded-xl bg-white border border-zinc-200 shadow-lg p-1',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      sideOffset={6}
      {...props}
    />
  </DropdownPrimitive.Portal>
);

export const DropdownItem: React.FC<DropdownPrimitive.DropdownMenuItemProps & { danger?: boolean }> = ({
  className, danger, ...props
}) => (
  <DropdownPrimitive.Item
    className={cn(
      'flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg cursor-pointer outline-none transition-colors',
      danger
        ? 'text-red-600 hover:bg-red-50'
        : 'text-zinc-700 hover:bg-zinc-100',
      className,
    )}
    {...props}
  />
);

export const DropdownSeparator = DropdownPrimitive.Separator;

// ─── Tooltip ──────────────────────────────────────────────────────────────────

import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip: React.FC<{ children: React.ReactNode; content: string; side?: 'top' | 'bottom' | 'left' | 'right' }> = ({
  children, content, side = 'top',
}) => (
  <TooltipPrimitive.Root delayDuration={400}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        className="z-50 px-2 py-1 text-xs rounded-md bg-zinc-900 text-white shadow"
      >
        {content}
        <TooltipPrimitive.Arrow className="fill-zinc-900" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);

// ─── Progress ─────────────────────────────────────────────────────────────────

export const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <div className={cn('w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden', className)}>
    <div
      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="mb-4 text-zinc-300">{icon}</div>
    <h3 className="text-base font-semibold text-zinc-700 mb-1">{title}</h3>
    {description && <p className="text-sm text-zinc-500 mb-4 max-w-xs">{description}</p>}
    {action}
  </div>
);
