import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  visible?: boolean;
  badge?: string | number;
  badgeVariant?: 'info' | 'error';
  hasErrors?: boolean;
  testId?: string;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon: Icon,
  defaultOpen = false,
  forceOpen = false,
  visible = true,
  badge,
  badgeVariant = 'info',
  hasErrors = false,
  testId,
  children,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultOpen || hasErrors);
  const prevDefaultOpenRef = React.useRef(defaultOpen);
  const baseId = React.useId();
  const headerId = `${testId || 'section'}-${baseId}-header`;
  const contentId = `${testId || 'section'}-${baseId}-content`;

  React.useEffect(() => {
    if (hasErrors) {
      setIsExpanded(true);
    }
  }, [hasErrors]);

  React.useEffect(() => {
    if (prevDefaultOpenRef.current !== defaultOpen) {
      prevDefaultOpenRef.current = defaultOpen;
      setIsExpanded(defaultOpen);
    }
  }, [defaultOpen]);

  // Complete DOM removal when visible === false unless forceOpen === true
  const isVisible = visible !== false || forceOpen === true;
  if (!isVisible) {
    return null;
  }

  // forceOpen overrides internal collapsed state when true
  const effectiveExpanded = forceOpen ? true : isExpanded;

  const handleToggle = () => {
    if (forceOpen) return;
    setIsExpanded((prev) => !prev);
  };

  const isTestEnv =
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
  const animDuration = forceOpen || isTestEnv ? 0 : 0.2;

  return (
    <div
      data-testid={testId}
      className={`bg-white border-2 ${
        hasErrors ? 'border-comic-red ring-2 ring-red-200' : 'border-black'
      } rounded shadow-comic-xs transition-colors`}
    >
      <div
        id={headerId}
        role="button"
        tabIndex={0}
        aria-expanded={effectiveExpanded}
        aria-controls={contentId}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        data-testid={testId ? `${testId}-toggle` : undefined}
        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-yellow-50/50 focus:outline-2 focus:outline-black focus:outline-offset-1 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              className="w-4 h-4 text-comic-accent shrink-0"
              data-testid={testId ? `${testId}-icon` : undefined}
            />
          )}
          <span className="font-bangers uppercase text-xs tracking-wider text-black">{title}</span>
          {badge !== undefined && (
            <span
              data-testid={testId ? `${testId}-badge` : undefined}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                badgeVariant === 'error'
                  ? 'bg-red-50 text-comic-red border-comic-red'
                  : 'bg-comic-yellow text-black border-black'
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: effectiveExpanded ? 0 : -90 }}
          transition={{ duration: animDuration > 0 ? 0.15 : 0 }}
          className="text-gray-600 flex items-center justify-center"
        >
          <ChevronDown
            className="w-4 h-4 text-black"
            data-testid={
              testId
                ? effectiveExpanded
                  ? `${testId}-chevron-down`
                  : `${testId}-chevron-right`
                : undefined
            }
          />
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {effectiveExpanded && (
          <motion.div
            key="content"
            initial={isTestEnv ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={isTestEnv ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: animDuration, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            id={contentId}
            role="region"
            aria-labelledby={headerId}
            data-testid={testId ? `${testId}-content` : undefined}
          >
            <div className="p-3 border-t border-gray-200">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
