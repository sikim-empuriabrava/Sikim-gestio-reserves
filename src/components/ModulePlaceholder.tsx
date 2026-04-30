import {
  BellAlertIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CubeIcon,
  LinkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import {
  OperationalFeatureCard,
  OperationalPageHeader,
  OperationalQuickActions,
  OperationalQuickNotes,
} from '@/components/operational/OperationalUI';

type PlaceholderCard = {
  title: string;
  description: string;
  badge?: string;
};

type QuickNotes = {
  title?: string;
  items: string[];
};

type ModulePlaceholderProps = {
  title: string;
  subtitle: string;
  cards: PlaceholderCard[];
  quickNotes?: QuickNotes;
  eyebrow?: string;
  showHeader?: boolean;
};

const cardIcons = [ClipboardDocumentListIcon, ClockIcon, PaperAirplaneIcon, CubeIcon, BellAlertIcon, LinkIcon];

function getCardIcon(title: string, index: number) {
  const normalized = title.toLowerCase();
  if (normalized.includes('stock') || normalized.includes('mise')) return CubeIcon;
  if (normalized.includes('alert')) return BellAlertIcon;
  if (normalized.includes('hist')) return ClockIcon;
  if (normalized.includes('compart')) return PaperAirplaneIcon;
  if (normalized.includes('integr')) return LinkIcon;
  return cardIcons[index % cardIcons.length];
}

export function ModulePlaceholder({
  title,
  subtitle,
  cards,
  quickNotes,
  eyebrow,
  showHeader = true,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      {showHeader ? <OperationalPageHeader eyebrow={eyebrow} title={title} description={subtitle} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <OperationalFeatureCard
            key={card.title}
            icon={getCardIcon(card.title, index)}
            title={card.title}
            description={card.description}
            badge={card.badge}
            highlighted={index === 0}
          />
        ))}
      </div>

      {quickNotes ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <OperationalQuickNotes items={quickNotes.items} />
          <OperationalQuickActions />
        </div>
      ) : null}
    </div>
  );
}
